import { useLocationFromQuery } from 'hooks/index';
import { useClosestSpeaker } from './useClosestSpeaker';
import { useLoop } from './useLoop';
import { useRecorder } from './useRecorder';
import { useSubmission } from './useSubmission';
import { useRealtimePlayback } from './useRealtimePlayback';

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

	// handles playback of mic input, with effects
	useRealtimePlayback({
		audioContext: loop.audioContext.current,
		recordingStream: recorder.recorderStream,
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