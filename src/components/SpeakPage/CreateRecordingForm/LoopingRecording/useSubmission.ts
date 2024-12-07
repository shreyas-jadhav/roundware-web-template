import { multiPolygon } from '@turf/helpers';
import { circle } from '@turf/turf';
import finalConfig from 'config';
import { useRoundware, useRoundwareDraft } from 'hooks/index';
import moment from 'moment';
import { useState } from 'react';
import { useHistory } from 'react-router';
import { IAssetData } from 'roundware-web-framework/dist/types/asset';
import { ITag } from 'roundware-web-framework/dist/types/index';

// hook to handle saving of the recording to server
export const useSubmission = ({ location, recordedAudioBlob, closestSpeakerId }: { location: { lat: number; lng: number }; recordedAudioBlob: Blob | null; closestSpeakerId: string | null; }) => {
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
			if (closestSpeakerId) {
				formData.append('parents', closestSpeakerId);
			}

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
