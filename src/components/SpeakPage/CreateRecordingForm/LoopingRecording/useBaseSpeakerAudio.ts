import { point } from '@turf/helpers';
import { useRoundware } from 'hooks/index';
import { useState, useEffect } from 'react';
import { ISpeakerData } from 'roundware-web-framework/dist/types/speaker';
import { useLoop } from './useLoop';

const getSpeakerAudioBuffer = async (uri: string, audioContext: AudioContext) => {
	const response = await fetch(uri);
	const arrayBuffer = await response.arrayBuffer();
	const buffer = await audioContext.decodeAudioData(arrayBuffer);
	return buffer;
};

export const useBaseSpeakerAudio = (
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

		if (!roundware.mixer.speakerTracks) return;

		const listenerPoint = point([lng, lat]);

		roundware.mixer.speakerTracks.forEach((speaker) => {
			speaker.updateParams(false, {
				listenerPoint,
			});
		});

		const sts = roundware.mixer.speakerTracks.filter((st) => {
			return st.outerBoundaryContains(listenerPoint) || st.attenuationShapeContains(listenerPoint);
		});
		console.debug(`SpeakerTracks:`, sts);

		(async () => {
			const audioBuffers = await Promise.all(
				sts.map(async (st) => ({
					buffer: await getSpeakerAudioBuffer(st.uri, loop.audioContext.current),
					volume: st.calculateVolume(),
				}))
			);

			const totalVolume = audioBuffers.reduce((acc, { volume }) => acc + volume, 0);

			// mix the audio buffers based on volume of each speaker
			const finalBufer = audioBuffers.reduce(
				(acc, { buffer, volume }) => {
					const ratio = volume / totalVolume;
					console.debug(`Mixing volume ${volume} buffer with ratio:`, ratio);
					const mixed = mix(acc, buffer, (a: number, b: number) => {
						return a * 1 + b * (ratio as number);
					});
					return mixed;
				},
				// create an empty buffer with the same length and sample rate as the first buffer
				loop.audioContext.current.createBuffer(audioBuffers[0].buffer.numberOfChannels, audioBuffers[0].buffer.length, audioBuffers[0].buffer.sampleRate)
			);

			loop.speakerAudioBuffer.current = finalBufer;
			if (sts.length > 0) setSpeaker(sts[0].speakerData);
			loop.setIsLoading(false);
			setAudioDuration(finalBufer.duration);
		})();
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

function mix(bufferA: AudioBuffer, bufferB: AudioBuffer, ratio?: number | ((a: number, b: number, i: number, channel: number) => number), offset?: number): AudioBuffer {
	if (ratio == null) ratio = 0.5;
	var fn =
		ratio instanceof Function
			? ratio
			: function (a: number, b: number) {
					return a * (1 - (ratio as number)) + b * (ratio as number);
			  };

	if (offset == null) offset = 0;
	else if (offset < 0) offset += bufferA.length;

	for (var channel = 0; channel < bufferA.numberOfChannels; channel++) {
		var aData = bufferA.getChannelData(channel);
		var bData = bufferB.getChannelData(channel);

		for (var i = offset, j = 0; i < bufferA.length && j < bufferB.length; i++, j++) {
			aData[i] = fn.call(bufferA, aData[i], bData[j], j, channel);
		}
	}

	return bufferA;
}
