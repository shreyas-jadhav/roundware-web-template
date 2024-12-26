import { point } from '@turf/helpers';
import finalConfig from 'config';
import { useRoundware } from 'hooks/index';
import { useEffect, useState } from 'react';
import { useLoop } from './useLoop';
import { ISpeakerData } from 'roundware-web-framework/dist/types/speaker';

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
			baseSpeakers: ISpeakerData[];
			duration: number;
			isReady: true;
	  }
	| {
			baseSpeakers: null;
			duration: null;
			isReady: false;
	  } => {
	const { roundware } = useRoundware();

	const [baseSpeakers, setBaseSpeakers] = useState<ISpeakerData[]>([]);

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

		let baseSpeakers =
			finalConfig.speak.baseRecordingLoopSelectionMethod === 'all'
				? sts
				: (() => {
						// map
						const tree = new Map<
							number,
							{
								children: Set<number>;
								parents: Set<number>;
							}
						>();

						sts.forEach((st) => {
							tree.set(st.speakerData.id, {
								children: 'children' in st.speakerData && Array.isArray(st.speakerData.children) ? new Set(st.speakerData.children) : new Set(),
								parents: 'parents' in st.speakerData && Array.isArray(st.speakerData.parents) ? new Set(st.speakerData.parents) : new Set(),
							});
						});

						// if there is not such parent, then remove that parent id from tree;
						tree.forEach((value) => {
							value.parents.forEach((parent) => {
								if (!tree.has(parent)) {
									value.parents.delete(parent);
								}
							});
						});

						// get the root nodes;
						const roots = Array.from(tree.entries()).filter(([, value]) => value.parents.size === 0);

						return roots.map(([id]) => sts.find((st) => st.speakerData.id === id)!);
				  })();

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
			setBaseSpeakers(baseSpeakers.map((s) => s.speakerData));
			loop.setIsLoading(false);
			setAudioDuration(finalBufer.duration);
		})();
	}, [lat, lng, roundware]);

	if (baseSpeakers.length === 0 || duration == null) {
		return {
			baseSpeakers: null,
			duration: null,
			isReady: false,
		};
	}
	console.debug('baseSpeakers', baseSpeakers);
	return {
		baseSpeakers,
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
