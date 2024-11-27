import { multiPolygon, point } from '@turf/helpers';
import { circle } from '@turf/turf';
import finalConfig from 'config';
import { useLocationFromQuery, useRoundware, useRoundwareDraft } from 'hooks/index';
import moment from 'moment';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router';
import { IAssetData } from 'roundware-web-framework/dist/types/asset';
import { ITag } from 'roundware-web-framework/dist/types/index';
import { ISpeakerData } from 'roundware-web-framework/dist/types/speaker';

export const useLoopingRecording = () => {
	// Get the location from the query string
	const location = useLocationFromQuery();

	// handle the overall loop;
	const loop = useLoop();

	// automatically selects closest speaker to the location
	const speaker = useClosestSpeaker(location.lat, location.lng, loop);

	// hook to handle recording
	const recorder = useRecorder({
		duration: speaker.duration || undefined,
		loop,
	});

	// handle submission of the recording
	const submission = useSubmission({
		location,
		recordedAudioBlob: recorder.recordedAudioBlob,
	});

	return {
		speaker,
		recorder,
		location,
		submission,
		loop,
	};
};

const useLoop = () => {
	const audioContext = useRef(new AudioContext());

	const [isLoading, setIsLoading] = useState(true);
	const [isStarted, setIsStarted] = useState(false);

	const speakerAudioBuffer = useRef<AudioBuffer | null>(null);
	const speakerSource = useRef<AudioBufferSourceNode | null>(null);
	const recorderSource = useRef<AudioBufferSourceNode | null>(null);

	const [mode, setMode] = useState<'idle' | 'playing-speaker' | 'waiting-to-record' | 'recording' | 'recording-playback'>('idle');
	console.debug({ mode });
	const interval = useRef<NodeJS.Timer | null>(null);

	const nextLoopPointAt = useRef<number | null>(null);

	const [speakerUri, setSpeakerUri] = useState<string | null>(null);

	const calculateNextPoint = () => {
		if (!speakerAudioBuffer.current) return;
		nextLoopPointAt.current = Date.now() + speakerAudioBuffer.current.duration * 1000;
		interval.current = setInterval(() => {
			if (!speakerAudioBuffer.current) return;
			nextLoopPointAt.current = Date.now() + speakerAudioBuffer.current.duration * 1000;
		}, speakerAudioBuffer.current.duration * 1000);
	};

	async function start(recordedAudioBlob?: Blob) {
		if (isLoading || !speakerAudioBuffer.current) return;

		await audioContext.current.resume();

		console.debug('Starting loop');
		setIsStarted(true);

		speakerSource.current = audioContext.current.createBufferSource();
		speakerSource.current.buffer = speakerAudioBuffer.current;
		const speakerGain = audioContext.current.createGain();

		// speaker gain to 0.5 if there is a recorded audio blob
		speakerGain.gain.value = 0;

		const finalSpeakerVolume = recordedAudioBlob ? 0.5 : 1;
		const fadeDuration = 0.3;

		speakerSource.current.connect(speakerGain);
		speakerGain.connect(audioContext.current.destination);

		speakerSource.current.loop = true;

		if (recordedAudioBlob) {
			console.debug('Starting loop with recordedAudioBlob');
			recorderSource.current = audioContext.current.createBufferSource();
			const blob = await recordedAudioBlob.arrayBuffer();

			audioContext.current.decodeAudioData(blob, (buffer) => {
				if (!recorderSource.current) return;
				if (!speakerAudioBuffer.current) return;

				// trim the buffer to the duration of the speaker
				const difference = buffer.duration - speakerAudioBuffer.current.duration;

				recorderSource.current.buffer = buffer;

				recorderSource.current.loop = true;

				if (difference > 0) {
					recorderSource.current.loopStart = difference / 2;
					recorderSource.current.loopEnd = buffer.duration - difference / 2;
				}

				// gain
				const recorderGain = audioContext.current.createGain();
				recorderGain.gain.value = 0;
				recorderSource.current.connect(recorderGain);
				recorderGain.connect(audioContext.current.destination);

				calculateNextPoint();
				recorderSource.current.start();

				recorderGain.gain.linearRampToValueAtTime(finalSpeakerVolume, audioContext.current.currentTime + fadeDuration);

				if (!speakerSource.current) return;
				speakerSource.current.start();

				setMode('recording-playback');
			});
		} else {
			recorderSource.current = null;
			calculateNextPoint();
			speakerSource.current.start();
			console.debug('speakerSource.current.start()');
			setMode((prev) => (prev === 'recording' ? 'recording' : 'playing-speaker'));
		}

		speakerGain.gain.linearRampToValueAtTime(finalSpeakerVolume, audioContext.current.currentTime + fadeDuration);
	}

	function stop() {
		if (interval.current) {
			clearInterval(interval.current);
		}
		if (speakerSource.current) {
			speakerSource.current.stop();
			speakerSource.current.disconnect();
		}
		if (recorderSource.current) {
			recorderSource.current.stop();
			recorderSource.current.disconnect();
		}
	}

	useEffect(() => {
		// fetch speaker uri, createBufferSource

		if (speakerUri && !speakerAudioBuffer.current) {
			fetch(speakerUri)
				.then((response) => response.arrayBuffer())
				.then((arrayBuffer) => {
					audioContext.current.decodeAudioData(arrayBuffer, (buffer) => {
						speakerAudioBuffer.current = buffer;
						console.debug('speakerAudioBuffer', speakerAudioBuffer.current);
						setIsLoading(false);
					});
				});
		}
	}, [speakerUri]);

	return {
		isLoading,
		isStarted,
		mode,
		setMode,
		start,
		stop,
		nextLoopPointAt,
		setSpeakerUri,
	};
};

// hook to handle saving of the recording to server
const useSubmission = ({ location, recordedAudioBlob }: { location: { lat: number; lng: number }; recordedAudioBlob: Blob | null }) => {
	const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

	const draftRecording = useRoundwareDraft();
	const { tagLookup, roundware } = useRoundware();
	const history = useHistory();

	async function start() {
		if (!recordedAudioBlob) {
			return;
		}
		// stop the audio

		setStatus('submitting');

		if (!finalConfig.speak.uploadAsSpeaker) {
			// upload as ASSET:

			const selected_tags = draftRecording.tags.map((tag) => tagLookup[tag]).filter((tag) => tag !== undefined);
			// include default speak tags
			const finalTags = selected_tags.map((t) => t?.tag_id).filter((t) => t !== undefined) as number[];
			finalConfig.speak.defaultSpeakTags?.forEach((t) => {
				if (!finalTags.includes(t)) {
					finalTags.push(t);
				}
			});

			const tags = await roundware.apiClient.get<ITag[]>('/tags', {
				project_id: roundware.project.projectId,
			});

			// @ts-ignore
			const speakerTag = tags.find((t) => t.value == selectedSpeakerId.current?.toString())?.id as number;

			if (speakerTag) {
				finalTags.push(speakerTag);
			}

			const assetMeta = {
				longitude: location.lng,
				latitude: location.lat,
				...(finalTags.length > 0 ? { tag_ids: finalTags } : {}),
			};
			const dateStr = new Date().toISOString();

			// Make an envelope to hold the uploaded assets.
			const envelope = await roundware.makeEnvelope();
			try {
				let asset: Partial<IAssetData> | null = null;
				// hold all promises for parallel execution
				const promises = [];
				// Add the audio asset.

				promises.push(
					(async () => {
						asset = await envelope.upload(recordedAudioBlob, dateStr + '.mp3', assetMeta);
					})()
				);
				await Promise.all(promises);
				setStatus('submitted');
				history.push(`/listen?eid=${envelope._envelopeId}`);
			} catch (err) {
				setStatus('error');
			}
		} else {
			const speakerShape = multiPolygon([
				circle([location.lng, location.lat], 10, {
					units: 'meters',
				}).geometry.coordinates,
			]);

			const formData = new FormData();
			formData.append('activeyn', 'true');
			formData.append('code', moment().format('DDMMYYHHmm'));
			formData.append('maxvolume', '1.0');
			formData.append('minvolume', '0.0');
			formData.append('shape', JSON.stringify(speakerShape.geometry));

			formData.append('file', recordedAudioBlob);
			formData.append('attenuation_distance', '5');
			formData.append('project_id', finalConfig.project.id.toString());

			const response: { uri: string } = await roundware.apiClient.post('/speakers/', formData, {
				method: 'POST',
				contentType: 'multipart/form-data',
			});

			history.push(`/listen`);
			setStatus('submitted');

			console.error('Response: ' + JSON.stringify(response, null, 2));

			if (!response) {
				setStatus('error');
			}
		}
	}

	return {
		status,
		start,
	};
};

const useRecorder = ({ duration, loop }: { duration?: number; loop: ReturnType<typeof useLoop> }) => {
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);

	const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);

	const [isPermissionDenied, setIsPermissionDenied] = useState(false);

	const checkMicrophonePermission = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
				},
			});
			stream.getTracks().forEach((track) => {
				track.stop();
				console.debug(track.readyState);
			});

			return true;
		} catch (error) {
			console.error('Microphone permission denied:', error);
			setIsPermissionDenied(true);
			return false;
		}
	};

	const scheduleRecording = async () => {
		const hasPermission = await checkMicrophonePermission();
		if (!hasPermission) return;
		if (typeof duration !== 'number') return;

		loop.setMode('waiting-to-record');

		console.debug('Scheduling recording', loop.nextLoopPointAt.current, Date.now());

		setTimeout(
			() => {
				startRecording();

				setTimeout(() => {
					stopRecording();
				}, duration * 1000);
			},
			loop.nextLoopPointAt.current ? loop.nextLoopPointAt.current - Date.now() : 0
		);
	};

	const startRecording = async () => {
		try {
			setRecordedAudioBlob(null);

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
				},
			});

			mediaRecorder.current = new MediaRecorder(stream);
			audioChunks.current = [];

			mediaRecorder.current.ondataavailable = (event) => {
				audioChunks.current.push(event.data);
			};

			mediaRecorder.current.onstop = () => {
				const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
				setRecordedAudioBlob(audioBlob);
				loop.stop();
				loop.start(audioBlob);
			};

			mediaRecorder.current.onstart = () => {
				console.debug('Recording started');
				loop.setMode('recording');
				loop.start();
			};

			loop.stop();
			mediaRecorder.current.start();
		} catch (error) {
			console.error('Error starting recording:', error);
			setIsPermissionDenied(true);
			loop.stop();
		}
	};

	const stopRecording = () => {
		if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
			mediaRecorder.current.stop();
			console.debug('Recording stopped');
		}
	};

	return {
		recordedAudioBlob,
		isPermissionDenied,
		setIsPermissionDenied,
		scheduleRecording,
		stopRecording,
		checkMicrophonePermission,
	};
};

const useClosestSpeaker = (
	lat: number,
	lng: number,
	loop: ReturnType<typeof useLoop>
):
	| {
			speaker: ISpeakerData;
			duration: number;
			isReady: true;
	  }
	| {
			speaker: null;
			duration: null;
			isReady: false;
	  } => {
	const { roundware } = useRoundware();

	const [speaker, setSpeaker] = useState<ISpeakerData | null>(null);
	const [duration, setAudioDuration] = useState<number | null>(null);

	useEffect(() => {
		if (!roundware.speakers) return;

		roundware.mixer.initializeSpeakers();
		roundware.mixer.speakerTracks?.forEach((speaker) => {
			speaker.updateParams(false, {
				listenerPoint: point([lng, lat]),
			});
		});

		const sts = roundware.mixer.speakerTracks?.sort((st1, st2) => {
			console.log('volume: ', st1.speakerData.id, st1.calculateVolume(), st1.listenerPoint);
			console.log('volume:', st2.speakerData.id, st2.calculateVolume());
			return st2.calculateVolume() - st1.calculateVolume();
		});

		if (sts && sts.length > 0) {
			const closestSpeaker = sts[0].speakerData;
			console.log('Found closest speaker: ', closestSpeaker.id);
			setSpeaker(closestSpeaker);

			const speakerAudio = new Audio();
			speakerAudio.src = closestSpeaker.uri;
			speakerAudio.loop = true;
			speakerAudio.addEventListener('loadedmetadata', () => {
				setAudioDuration(speakerAudio.duration);
				loop.setSpeakerUri(closestSpeaker.uri);
			});
		}
	}, [lat, lng, roundware]);

	if (speaker == null || duration == null) {
		return {
			speaker: null,
			duration: null,
			isReady: false,
		};
	}

	return {
		speaker,
		duration,
		isReady: true,
	};
};
