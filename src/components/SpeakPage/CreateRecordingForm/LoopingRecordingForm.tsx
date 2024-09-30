import { ArrowForwardIos } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Button, Card, CardContent, Collapse, Stack, Typography, useTheme } from '@mui/material';
import centerOfMass from '@turf/center-of-mass';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
import { useRoundware } from 'hooks/index';
import { useEffect, useRef, useState } from 'react';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import { useLocation } from 'react-router';
import { ISpeakerData } from 'roundware-web-framework/dist/types/speaker';
const LoopingRecordingForm = () => {
	const [start, setStart] = useState(false);

	const { search } = useLocation();

	const { roundware } = useRoundware();

	const [audioDuration, setAudioDuration] = useState(0);
	const speakerAudio = useRef(new Audio());

	const theme = useTheme();

	const [loadingSpeakerAudio, setLoadingSpeakerAudio] = useState(false);

	useEffect(() => {
		if (!roundware.speakers) return;
		console.log(roundware.speakers);

		if (search) {
			const params = new URLSearchParams(search);

			const lat = parseInt(params.get('lat') as string) ?? 0;
			const lng = parseInt(params.get('lng') as string) ?? 0;

			// get closest speaker

			const closestSpeaker = roundware.speakers().reduce(
				(
					selected: {
						speaker: ISpeakerData | null;
						dist: number;
					},
					speaker
				) => {
					const dist = distance(centerOfMass(speaker.shape), point([lng, lat]));
					return dist < selected.dist ? { speaker, dist } : selected;
				},
				{ speaker: null, dist: Infinity }
			);

			if (closestSpeaker.speaker) {
				// speaker.uri
				// first determine the length of the audio
				// then store it
				speakerAudio.current.src = closestSpeaker.speaker.uri;
				speakerAudio.current.loop = true;
				speakerAudio.current.addEventListener('loadedmetadata', () => {
					setAudioDuration(speakerAudio.current.duration);
				});
			}
		}
	}, [search, roundware]);

	return (
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
								onClick={() => {
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
								colors={theme.palette.primary.main}
								isPlaying={start}
								onComplete={() => {
									return [true, 0];
								}}
							>
								{countdownChildren}
							</CountdownCircleTimer>
						)}
					</Stack>
				</Collapse>
			</CardContent>
		</Card>
	);
};

const countdownChildren = ({ remainingTime }: { remainingTime: number }) => {
	const minutes = Math.floor(remainingTime / 60);
	const seconds = remainingTime % 60;

	// should be 2 digits
	const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
	const displaySeconds = seconds < 10 ? `0${seconds}` : seconds;

	return (
		<div>
			<Typography variant='h4' textAlign={'center'}>
				{displayMinutes}:{displaySeconds}
			</Typography>
		</div>
	);
};
export default LoopingRecordingForm;
