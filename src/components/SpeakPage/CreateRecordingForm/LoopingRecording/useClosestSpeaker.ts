import { point } from '@turf/helpers';
import { useRoundware } from 'hooks/index';
import { useState, useEffect } from 'react';
import { ISpeakerData } from 'roundware-web-framework/dist/types/speaker';
import { useLoop } from './useLoop';

export const useClosestSpeaker = (
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

			fetch(closestSpeaker.uri)
				.then((response) => response.arrayBuffer())
				.then((arrayBuffer) => {
					loop.audioContext.current.decodeAudioData(arrayBuffer, (buffer) => {
						loop.speakerAudioBuffer.current = buffer;
						console.debug('speakerAudioBuffer', loop.speakerAudioBuffer.current);
						setSpeaker(closestSpeaker);
						loop.setIsLoading(false);
						setAudioDuration(buffer.duration);
					});
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
