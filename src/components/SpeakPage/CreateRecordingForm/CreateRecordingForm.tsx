import { Create, FileUpload, Headphones, Share } from '@mui/icons-material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import MicIcon from '@mui/icons-material/Mic';
import { Alert, IconButton, LinearProgress, Snackbar, Stack } from '@mui/material';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import ID3Writer from 'browser-id3-writer';
import config from 'config';
import { useUIContext } from 'context/UIContext';
import { useRoundwareDraft } from 'hooks';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import { Prompt } from 'react-router-dom';
import { IAssetData } from 'roundware-web-framework/dist/types/asset';
import AudioPlayer from '../../AudioPlayer';
import ErrorDialog from '../../ErrorDialog';
import LegalAgreementForm from '../../LegalAgreementForm';
import AdditionalMediaMenu from './AdditionalMediaMenu';
import { useStyles } from './styles';
import useCreateRecording from './useCreateRecording';
import PermissionDeniedDialog from 'components/elements/PermissionDeniedDialog';

const CreateRecordingForm = () => {
	const { draftMediaUrl, textAsset, imageAssets, set_draft_recording_media, set_draft_media_url, draftRecording, setSuccess, selectAsset, roundware, draftRecordingMedia, updateAssets, saving, resetFilters, history, setTextAsset, setSaving, deleteRecording, legalModalOpen, setLegalModalOpen, setImageAssets, success, selected_tags, error, isRecording, toggleRecording, isExtraSmallScreen, setError, maxRecordingLength, stopRecording, setDeleteModalOpen, deleteModalOpen, timer, setTimer, ...cr } = useCreateRecording();
	const classes = useStyles();
	const handleOnSnackbarClose = () => {
		if (timer) clearTimeout(timer);
		setTimer(null);
	};
	const { handleShare } = useUIContext();

	const { user } = useRoundwareDraft();
	return (
		<>
			<Card className={classes.container}>
				{/* permission denied */}
				<PermissionDeniedDialog
					open={cr.isPermissionDenied}
					onClose={() => {
						cr.setIsPermissionDenied(false);
					}}
					functionality='microphone'
				/>
				{/* unsaved prompt */}
				<Prompt
					when={!!draftMediaUrl && !success}
					message={JSON.stringify({
						message: `Are you sure you want to leave without submitting your recording? If you do, your recording will be deleted.`,
						stay: `Keep Recording`,
						leave: `Delete Recording`,
					})}
				/>

				<Grid container alignItems={'center'} direction={'column'} spacing={2} justifyContent='center'>
					<Grid item mt={3}>
						<Typography variant={'h5'} className={classes.tagGroupHeaderLabel} key={selected_tags.length > 0 ? selected_tags[selected_tags.length - 1]?.id : 1} gutterBottom>
							{selected_tags.length > 0 ? selected_tags[selected_tags.length - 1]?.tag_display_text : 'No selected tags'}
						</Typography>
					</Grid>
					<ErrorDialog error={error} set_error={setError} />
					{!draftMediaUrl && (
						<Grid item xs={12} className={classes.audioVisualizer}>
							<canvas id='audio-visualizer' style={{ height: isExtraSmallScreen ? 100 : 150, width: 300 }} />
						</Grid>
					)}

					{draftMediaUrl ? (
						<Grid item xs={12}>
							{/*}<audio id={"draft-audio"} src={draftMediaUrl} controls />*/}
							{/* id prop not availabe on this component prop types - Shreyas */}
							{/* <AudioCard src={draftMediaUrl} mute={false} forward={false} backward={false} width={300} volume={false} /> */}
							<AudioPlayer size='large' src={draftMediaUrl} />
						</Grid>
					) : null}
					{!draftMediaUrl && !isRecording ? (
						<Grid item xs={12} spacing={1} container direction='row' justifyContent='center' alignItems='center'>
							<Grid
								item
								style={{
									paddingBottom: 0,
									paddingTop: isExtraSmallScreen ? 8 : 32,
								}}
								flexDirection='row'
								justifyContent={'center'}
							>
								<IconButton
									disabled={draftMediaUrl !== ''}
									style={{
										margin: 'auto',
										backgroundColor: isRecording ? 'red' : 'inherit',
										padding: 0,
									}}
									onClick={toggleRecording}
									size='large'
								>
									<MicIcon color={isRecording ? 'primary' : 'inherit'} className={classes.iconButton} />
								</IconButton>

								<Typography textAlign='center' variant={'subtitle1'}>
									Tap to Record
								</Typography>
							</Grid>

							<Grid
								item
								display={{
									xs: 'none',
									md: 'initial',
								}}
								style={{
									paddingBottom: 0,
									paddingTop: isExtraSmallScreen ? 8 : 32,
								}}
								justifyContent='left'
							>
								<Button
									disabled={draftMediaUrl !== ''}
									style={{
										margin: 'auto',
										backgroundColor: isRecording ? 'red' : 'inherit',
										padding: 0,
										borderRadius: '50%',
									}}
									size='large'
									component='label'
								>
									<FileUpload color={isRecording ? 'primary' : 'inherit'} className={classes.iconButton} />
									<input
										onChange={(e) => {
											if (!e.target.files) return;
											const file = Array.from(e.target.files)[0];

											const reader = new FileReader();
											reader.onload = function () {
												const arrayBuffer = reader.result;

												const writer = new ID3Writer(arrayBuffer);
												writer.removeTag();

												const url = writer.getURL();
												set_draft_media_url(url);
												set_draft_recording_media(writer.getBlob());
											};
											reader.onerror = function () {
												// handle error
												console.error('Reader error', reader.error);
											};
											reader.readAsArrayBuffer(file);
										}}
										type='file'
										hidden
										accept='.mp3, .wav'
									/>
								</Button>

								<Typography textAlign='center' variant={'subtitle1'}>
									Tap to Upload Audio
								</Typography>
							</Grid>
						</Grid>
					) : null}

					{isRecording ? (
						<Grid item xs={12}>
							<CountdownCircleTimer
								isPlaying
								duration={parseInt(maxRecordingLength.toString())}
								size={isExtraSmallScreen ? 140 : 180}
								strokeWidth={isExtraSmallScreen ? 8 : 12}
								onComplete={() => {
									stopRecording();
								}}
								trailColor='#000000'
								colors={[
									['#DDDDDD', 0.33],
									['#DDDDDD', 0.33],
									['#719EE3', 0.33],
								]}
							>
								{({ remainingTime }: { remainingTime: number }) => (
									<Grid container direction='column' alignItems='center'>
										<Grid item>
											<Typography variant='h3' style={{ textAlign: 'center' }}>
												{Math.floor(remainingTime / 60) +
													':' +
													(remainingTime % 60).toLocaleString('en-US', {
														minimumIntegerDigits: 2,
														useGrouping: false,
													})}
											</Typography>
										</Grid>
										<Grid item>
											<IconButton
												disabled={draftMediaUrl !== ''}
												style={{
													margin: 'auto',
													backgroundColor: isRecording ? 'red' : 'inherit',
													justifyContent: 'center',
												}}
												onClick={toggleRecording}
												size='large'
											>
												<MicIcon color={isRecording ? 'primary' : 'inherit'} className={classes.iconButtonSmall} />
											</IconButton>
										</Grid>
									</Grid>
								)}
							</CountdownCircleTimer>
							<Typography sx={{ my: 2 }} textAlign='center' variant={'subtitle1'}>
								Tap to Stop
							</Typography>
						</Grid>
					) : null}

					<Grid
						container
						item
						style={{
							paddingLeft: isExtraSmallScreen ? 8 : 32,
							paddingRight: isExtraSmallScreen ? 8 : 32,
							paddingTop: isExtraSmallScreen ? 16 : 32,
						}}
					>
						<Button
							style={{ margin: 'auto' }}
							variant='contained'
							color='secondary'
							size={isExtraSmallScreen ? 'small' : 'medium'}
							startIcon={<DeleteIcon />}
							disabled={draftMediaUrl === ''}
							onClick={() => {
								setDeleteModalOpen(true);
							}}
						>
							Delete
						</Button>

						<Dialog open={deleteModalOpen}>
							<DialogContent>
								<DialogContentText>Delete your current draft recording?</DialogContentText>
							</DialogContent>

							<DialogActions>
								<Button
									variant='contained'
									color='primary'
									onClick={() => {
										setDeleteModalOpen(false);
									}}
								>
									No, keep it!
								</Button>
								<Button
									variant='contained'
									color='secondary'
									onClick={() => {
										deleteRecording();
										setDeleteModalOpen(false);
									}}
								>
									Yes, delete it!
								</Button>
							</DialogActions>
						</Dialog>
						{config.speak.allowPhotos === true || config.speak.allowText === true ? <AdditionalMediaMenu onSetText={setTextAsset} onSetImage={(file) => setImageAssets([...imageAssets, file])} textAsset={textAsset} imageAssets={imageAssets} disabled={draftMediaUrl === ''} /> : null}
						<Button
							variant='contained'
							color='primary'
							size={isExtraSmallScreen ? 'small' : 'medium'}
							startIcon={<CloudUploadIcon />}
							style={{ margin: 'auto' }}
							disabled={draftMediaUrl === ''}
							onClick={() => {
								setLegalModalOpen(true);
							}}
						>
							Submit
						</Button>
						<Dialog open={legalModalOpen}>
							<LegalAgreementForm
								onDecline={() => {
									setLegalModalOpen(false);
								}}
								onAccept={async () => {
									setLegalModalOpen(false);
									setSaving(true);
									if (typeof draftRecording.location.longitude !== 'number' || typeof draftRecording.location.latitude !== 'number') {
										return setError(new Error(`Failed to get latitude & longitude!`));
									}

									// include default speak tags
									const finalTags = selected_tags.map((t) => t?.tag_id).filter((t) => t !== undefined) as number[];
									config.speak.defaultSpeakTags?.forEach((t) => {
										if (!finalTags.includes(t)) {
											finalTags.push(t);
										}
									});

									const assetMeta = {
										longitude: draftRecording.location.longitude,
										latitude: draftRecording.location.latitude,
										...(finalTags.length > 0 ? { tag_ids: finalTags } : {}),
									};
									const dateStr = new Date().toISOString();

									// Make an envelope to hold the uploaded assets.
									const envelope = await roundware.makeEnvelope();
									try {
										if (draftRecordingMedia == null) throw new Error(`RecordingMedia data was null!`);

										let asset: Partial<IAssetData> | null = null;
										// hold all promises for parallel execution
										const promises = [];
										// Add the audio asset.
										promises.push(
											(async () => {
												asset = await envelope.upload(draftRecordingMedia, dateStr + '.mp3', assetMeta);
											})()
										);
										if (textAsset) {
											promises.push(
												// Add the text asset, if any.

												envelope.upload(new Blob([textAsset.toString()], { type: 'text/plain' }), dateStr + '.txt', { ...assetMeta, media_type: 'text' })
											);
										}
										for (const file of imageAssets) {
											promises.push(
												envelope.upload(file, file.name || dateStr + '.jpg', {
													...assetMeta,
													media_type: 'photo',
												})
											);
										}
										if (user)
											promises.push(
												// Add the user asset, if any.
												roundware.user.updateUser(user)
											);

										await Promise.all(promises);
										selectAsset(null);
										setSuccess(asset);

										updateAssets();
									} catch (err) {
										// @ts-ignore
										set_error(err);
									}
									setSaving(false);
								}}
							/>
						</Dialog>
					</Grid>
					<Dialog open={saving}>
						<DialogContent>
							<CircularProgress color={'primary'} style={{ margin: 'auto' }} />
							<DialogContentText>Uploading your contribution now! Please keep this page open until we finish uploading.</DialogContentText>
						</DialogContent>
					</Dialog>
					<Dialog open={success !== null}>
						<DialogContent>
							<DialogContentText style={{ textAlign: 'center' }}>
								<CheckCircleIcon color={'primary'} />
							</DialogContentText>
							<DialogContentText>Upload Complete! Thank you for participating!</DialogContentText>
						</DialogContent>
						<DialogActions
							sx={{
								flexWrap: 'wrap',
								flexDirection: 'column',
							}}
						>
							<Stack spacing={1} maxWidth={300}>
								<Button
									startIcon={<Share />}
									onClick={() => {
										handleShare(`${window.location.origin}/listen?eid=${success?.envelope_ids[0]}`);
									}}
									color='primary'
									variant='contained'
								>
									Share
								</Button>
								<Button
									variant={'contained'}
									color={'primary'}
									disabled={success == null}
									onClick={() => {
										if (success != null && Array.isArray(success.envelope_ids) && success.envelope_ids.length > 0) {
											resetFilters();
											history.push(`/listen?eid=${success.envelope_ids[0]}`);
										}
									}}
									startIcon={<Headphones />}
								>
									Listen
								</Button>
								<Button
									variant={'contained'}
									color={'primary'}
									onClick={() => {
										draftRecording.reset();
										history.push({
											pathname: '/speak',
											search: history.location.search,
										});
									}}
									startIcon={<Create />}
								>
									Create New Recording
								</Button>
							</Stack>
						</DialogActions>
					</Dialog>
				</Grid>
			</Card>
			{/* resetting timer snackbar */}

			<Snackbar open={!!timer} message={`Resetting in ${cr.progress} seconds`} autoHideDuration={config.features.autoResetTimeSeconds * 1000} onClose={handleOnSnackbarClose}>
				<Alert onClose={handleOnSnackbarClose} severity='info' sx={{ width: '100%' }}>
					Resetting in{' '}
					{
						// value of time remaining from progress percent
						Math.round((config.features.autoResetTimeSeconds * (100 - cr.progress)) / 100)
					}
					{` `}
					seconds...
					<LinearProgress value={cr.progress} variant='determinate' />
				</Alert>
			</Snackbar>
		</>
	);
};
export default CreateRecordingForm;
