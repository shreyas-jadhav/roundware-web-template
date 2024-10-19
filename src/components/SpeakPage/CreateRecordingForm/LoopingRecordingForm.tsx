import { ArrowForwardIos, Check, Mic } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Card, CardContent, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grow, Stack, Typography, useTheme } from '@mui/material';
import { point } from '@turf/helpers';
import PermissionDeniedDialog from 'components/elements/PermissionDeniedDialog';
import LegalAgreementForm from 'components/LegalAgreementForm';
import finalConfig from 'config';
import { useRoundware, useRoundwareDraft } from 'hooks/index';
import { useEffect, useRef, useState } from 'react';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import { Prompt, useHistory, useLocation } from 'react-router';
import { IAssetData } from 'roundware-web-framework/dist/types/asset';
import { ITag } from 'roundware-web-framework/dist/types/index';

const LoopingRecordingForm = () => {
	const [start, setStart] = useState(false);
	const { search } = useLocation();
	const history = useHistory();

	const [audioDuration, setAudioDuration] = useState(0);

	const speakerAudio = useRef(new Audio());
	const recordedAudio = useRef(new Audio());

	const theme = useTheme();
	const { roundware, tagLookup } = useRoundware();
	const [loadingSpeakerAudio, setLoadingSpeakerAudio] = useState(false);
	const [isPermissionDenied, setIsPermissionDenied] = useState(false);
	const [mode, setMode] = useState<'playing' | 'recording' | 'waiting'>('playing');
	const [draftMediaUrl, setDraftMediaUrl] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);

	const selectedSpeakerId = useRef<number | null>(null);

	useEffect(() => {
		if (!roundware.speakers) return;

		if (search) {
			const params = new URLSearchParams(search);
			const lat = parseFloat(params.get('lat') as string) ?? 0;
			const lng = parseFloat(params.get('lng') as string) ?? 0;
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
			console.log(sts);
			if (sts && sts.length > 0) {
				const closestSpeaker = sts[0].speakerData;
				selectedSpeakerId.current = closestSpeaker.id;
				speakerAudio.current.src = closestSpeaker.uri;
				speakerAudio.current.loop = true;
				speakerAudio.current.addEventListener('loadedmetadata', () => {
					setAudioDuration(speakerAudio.current.duration);
				});
			}
		}
	}, [search, roundware]);

	useEffect(() => {
		return () => {
			if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
				mediaRecorder.current.stop();
			}
			speakerAudio.current.pause();
			speakerAudio.current.currentTime = 0;
			recordedAudio.current.pause();
			recordedAudio.current.currentTime = 0;
		};
	}, []);

	const checkMicrophonePermission = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			stream.getTracks().forEach((track) => track.stop());
			return true;
		} catch (error) {
			console.error('Microphone permission denied:', error);
			setIsPermissionDenied(true);
			return false;
		}
	};

	const handleStartRecording = async () => {
		const hasPermission = await checkMicrophonePermission();
		if (!hasPermission) return;

		setMode('waiting');
		const audioCurrentTime = speakerAudio.current.currentTime;
		const loopPoint = Date.now() - audioCurrentTime * 1000 + audioDuration * 1000;

		setTimeout(() => {
			setMode('recording');
			startRecording();

			setTimeout(() => {
				stopRecording();
				setMode('playing');
			}, audioDuration * 1000);
		}, loopPoint - Date.now());
	};

	const startRecording = async () => {
		try {
			setDraftMediaUrl(null);
			recordedAudio.current.pause();
			recordedAudio.current.currentTime = 0;
			recordedAudio.current.src = '';

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
				const audioUrl = URL.createObjectURL(audioBlob);
				setDraftMediaUrl(audioUrl);
				recordedAudio.current.src = audioUrl;
				recordedAudio.current.loop = true;
				recordedAudio.current.play();

				recordedAudio.current.volume = 1;

				speakerAudio.current.volume = 0.5;
			};
			speakerAudio.current.volume = 1; // before recording, set the volume to 1
			mediaRecorder.current.start();
		} catch (error) {
			console.error('Error starting recording:', error);
			setIsPermissionDenied(true);
		}
	};

	const stopRecording = () => {
		if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
			mediaRecorder.current.stop();
			setMode('playing');
		}
	};

	const [showRerecordConfirm, setShowRerecordConfirm] = useState(false);

	const [legalModalOpen, setLegalModalOpen] = useState(false);

	const [saving, setSaving] = useState(false);

	const draftRecording = useRoundwareDraft();

	const selected_tags = draftRecording.tags.map((tag) => tagLookup[tag]).filter((tag) => tag !== undefined);

	return (
		<>
			<PermissionDeniedDialog open={isPermissionDenied} onClose={() => setIsPermissionDenied(false)} functionality='microphone' />
			<Prompt
				when={!!draftMediaUrl && !success}
				message={JSON.stringify({
					message: `Are you sure you want to leave without submitting your recording? If you do, your recording will be deleted.`,
					stay: `Keep Recording`,
					leave: `Delete Recording`,
				})}
			/>

			<Card>
				<CardContent>
					<Collapse in={!start}>
						<Stack spacing={4} p={4}>
							<Typography variant='h5' fontWeight={'bold'} textAlign={'center'}>
								Amazing! You are about to add your voice to the choir of voices that exist in this location.
							</Typography>
							<Typography variant='h6' textAlign={'center'}>
								Tap the START button and you will hear a loop of the base music for this choir. When you are ready to record, tap the RECORD button and you will see a countdown indicator that displays how much time remains until the recording will start. Then sing along however you want.
							</Typography>

							<Stack direction={'row'} spacing={2} justifyContent={'center'}>
								<LoadingButton
									variant='contained'
									size='large'
									color='primary'
									sx={{
										fontSize: '1.3rem',
										fontWeight: 'bold',
									}}
									endIcon={<ArrowForwardIos />}
									loading={loadingSpeakerAudio}
									onClick={async () => {
										const hasPermission = await checkMicrophonePermission();
										if (!hasPermission) return;

										setLoadingSpeakerAudio(true);
										speakerAudio.current
											.play()
											.then(() => {
												setStart(true);
											})
											.finally(() => {
												setLoadingSpeakerAudio(false);
											});
									}}
								>
									START
								</LoadingButton>
							</Stack>
						</Stack>
					</Collapse>

					<Collapse in={start}>
						<Stack spacing={4} p={4} alignItems={'center'} justifyContent={'center'}>
							{audioDuration > 0 && (
								<CountdownCircleTimer
									duration={audioDuration}
									colors={mode === 'recording' ? theme.palette.error.main : theme.palette.primary.main}
									trailColor={theme.palette.grey[800]}
									isPlaying={start}
									onComplete={() => {
										if (mode === 'recording') {
											stopRecording();
										}
										return [true, 0];
									}}
								>
									<Stack
										sx={{
											width: '100%',
											height: '100%',
											display: 'flex',
											flexDirection: 'column',
											justifyContent: 'center',
											alignItems: 'center',
										}}
									>
										<Grow in={mode === 'playing'}>
											<Button
												variant='contained'
												color='primary'
												sx={{
													fontWeight: 'bold',
													background: theme.palette.error.main,
													'&:hover': {
														background: theme.palette.error.dark,
													},
													position: 'absolute',
												}}
												endIcon={<Mic />}
												onClick={() => {
													if (draftMediaUrl) {
														setDraftMediaUrl(null);
														recordedAudio.current.pause();
														recordedAudio.current.currentTime = 0;
														recordedAudio.current.src = '';
														setShowRerecordConfirm(true);
													} else handleStartRecording();
												}}
												size={draftMediaUrl ? 'small' : 'medium'}
											>
												{draftMediaUrl ? 'Re-record' : 'Record'}
											</Button>
										</Grow>

										<Grow in={mode === 'recording'}>
											<Typography variant='subtitle2' textAlign={'center'}>
												Recording...
											</Typography>
										</Grow>

										<Grow in={mode === 'waiting'}>
											<Typography
												variant='subtitle2'
												textAlign={'center'}
												sx={{
													position: 'absolute',
													color: 'GrayText',
													transform: 'translateY(-50%)',
												}}
											>
												Waiting to record...
											</Typography>
										</Grow>
									</Stack>
								</CountdownCircleTimer>
							)}

							{draftMediaUrl && (
								<Stack spacing={2} alignItems={'center'}>
									<Typography variant='body1' textAlign={'center'}>
										Hit SUBMIT to add your voice to this invisible choir for everyone else to hear.
									</Typography>
									<Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
										<Button
											variant='contained'
											color='primary'
											onClick={() => {
												setSuccess(true);
												setLegalModalOpen(true);
											}}
											size='large'
											sx={{
												fontWeight: 'bold',
											}}
											endIcon={<Check />}
										>
											Submit
										</Button>
									</Box>
								</Stack>
							)}
						</Stack>
					</Collapse>
				</CardContent>

				<Dialog open={showRerecordConfirm} onClose={() => setShowRerecordConfirm(false)}>
					<DialogTitle>Are you sure you want to re-record your message?</DialogTitle>
					<DialogContent>
						<Typography variant='body1' gutterBottom>
							You will lose your current recording if you re-record.
						</Typography>
					</DialogContent>
					<DialogActions>
						<Button onClick={() => setShowRerecordConfirm(false)}>Cancel</Button>
						<Button
							color='error'
							onClick={() => {
								setShowRerecordConfirm(false);
								handleStartRecording();
							}}
							variant='contained'
						>
							Re-record
						</Button>
					</DialogActions>
				</Dialog>

				<Dialog open={legalModalOpen}>
					<LegalAgreementForm
						onDecline={() => {
							setLegalModalOpen(false);
						}}
						onAccept={async () => {
							// stop the audio
							speakerAudio.current.pause();
							speakerAudio.current.currentTime = 0;
							recordedAudio.current.pause();
							recordedAudio.current.currentTime = 0;

							setLegalModalOpen(false);
							setSaving(true);

							// fetch all the tags;

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

							const params = new URLSearchParams(search);

							const assetMeta = {
								longitude: parseFloat(params.get('lng') as string),
								latitude: parseFloat(params.get('lat') as string),
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
								const draftRecordingMedia = new Blob([audioChunks.current[0]], { type: 'audio/wav' });
								promises.push(
									(async () => {
										asset = await envelope.upload(draftRecordingMedia, dateStr + '.mp3', assetMeta);
									})()
								);

								await Promise.all(promises);
								history.push(`/listen?eid=${envelope._envelopeId}`);
							} catch (err) {}
							setSaving(false);
						}}
					/>
				</Dialog>

				<Dialog open={saving}>
					<DialogContent>
						<CircularProgress color={'primary'} style={{ margin: 'auto' }} />
						<DialogContentText>Uploading your contribution now! Please keep this page open until we finish uploading.</DialogContentText>
					</DialogContent>
				</Dialog>
			</Card>
		</>
	);
};

export default LoopingRecordingForm;
