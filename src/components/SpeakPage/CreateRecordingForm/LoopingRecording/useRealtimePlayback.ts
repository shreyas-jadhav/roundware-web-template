import { useEffect } from 'react';

/*

Vol: 1
Delay: 0
Reverb: 0.5
Threshold: -20
Knee: 20
Ratio: 12
Attack: 10ms
Release: 250ms

*/

const PARAMS = {
	vol: 1,
	delay: 0,
	reverb: 0.5,
	threshold: -20,
	knee: 20,
	ratio: 12,
	attack: 0.01,
	release: 0.25,
};

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
