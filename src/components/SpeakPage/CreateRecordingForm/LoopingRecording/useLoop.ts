import { useRef, useState, useEffect } from 'react';

export const useLoop = () => {
	const audioContext = useRef(new AudioContext());

	const [isLoading, setIsLoading] = useState(true);
	const [isStarted, setIsStarted] = useState(false);

	const speakerAudioBuffer = useRef<AudioBuffer | null>(null);
	const speakerSource = useRef<AudioBufferSourceNode | null>(null);
	const recordedAudioSource = useRef<AudioBufferSourceNode | null>(null);

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
			recordedAudioSource.current = audioContext.current.createBufferSource();
			const blob = await recordedAudioBlob.arrayBuffer();

			audioContext.current.decodeAudioData(blob, (buffer) => {
				if (!recordedAudioSource.current) return;
				if (!speakerAudioBuffer.current) return;

				recordedAudioSource.current.buffer = buffer;
				recordedAudioSource.current.loop = true;

				// trim the buffer to the duration of the speaker
				const difference = buffer.duration - speakerAudioBuffer.current.duration;

				if (difference > 0) {
					recordedAudioSource.current.loopStart;
					recordedAudioSource.current.loopEnd = buffer.duration - difference;
				}

				// gain
				const recorderGain = audioContext.current.createGain();
				recorderGain.gain.value = 0;
				recordedAudioSource.current.connect(recorderGain);
				recorderGain.connect(audioContext.current.destination);

				calculateNextPoint();
				recordedAudioSource.current.start();

				recorderGain.gain.linearRampToValueAtTime(finalSpeakerVolume, audioContext.current.currentTime + fadeDuration);

				if (!speakerSource.current) return;
				speakerSource.current.start();

				setMode('recording-playback');
			});
		} else {
			recordedAudioSource.current = null;
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
		if (recordedAudioSource.current) {
			recordedAudioSource.current.stop();
			recordedAudioSource.current.disconnect();
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
		audioContext,
	};
};
