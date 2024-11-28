import { useEffect } from 'react';

export const useRealtimePlayback = ({ audioContext, recordingStream }: { audioContext: AudioContext; recordingStream?: MediaStream }) => {
	// you need to check on the recordingStream every time it changes.
	// also when unmounting,
	// please make sure to stop the playback
	// and clean up the resources
	useEffect(() => {
		if (!recordingStream) return;

		// HERE:
		// when recordingStream is available,
		// setup live playback from the stream
		// along with the effects

		return () => {
			// HERE: cleanup the resources / effects / stop the playback
		};
	}, [audioContext, recordingStream?.id]);
};
