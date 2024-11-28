import { useRef, useState } from 'react';
import { useLoop } from './useLoop';

export const useRecorder = ({ duration, loop }: { duration?: number; loop: ReturnType<typeof useLoop> }) => {
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);

	const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);

	const [isPermissionDenied, setIsPermissionDenied] = useState(false);

	const [recorderStream, setRecorderStream] = useState<MediaStream>();

	// just for checking permission start a small recording and stop it
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

	// schedule recording to start from next loop point in timer
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

			setRecorderStream(stream);

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
		recorderStream,
	};
};
