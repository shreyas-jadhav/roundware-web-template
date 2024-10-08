import React, { useEffect } from 'react';
import { useRoundware } from '../../hooks';
import TagSelectForm from './TagSelectForm';
import LocationSelectForm from './LocationSelectForm';
import CreateRecordingForm from './CreateRecordingForm/CreateRecordingForm';
import Grid from '@mui/material/Grid';
import { makeStyles } from '@mui/styles';
import { Route, Switch, useHistory } from 'react-router-dom';
import { DraftRecordingProvider } from '../../providers/DraftRecordingProvider';
import { config } from 'process';
import finalConfig from 'config';
import LoopingRecordingForm from './CreateRecordingForm/LoopingRecordingForm';

const useStyles = makeStyles((theme) => {
	return {
		root: {
			paddingTop: theme.spacing(3),
			paddingBottom: theme.spacing(3),
		},
		rootFormContainer: {
			paddingTop: '3rem',
			paddingBottom: '3rem',
			[theme.breakpoints.down('md')]: {
				paddingTop: 0,
				paddingBottom: 0,
			},
		},
		responsiveFormContainer: {
			margin: 'auto',
		},
	};
});

interface SpeakPageProps {
	match: {
		isExact: boolean;
		path: string;
	};
}
const SpeakPage = (props: SpeakPageProps) => {
	const { roundware } = useRoundware();
	const styles = useStyles();
	const history = useHistory();
	useEffect(() => {
		// if we are directed to the 'speak' page directly,
		// redirect to the first tag selection page

		if (props.match.isExact === true) {
			history.replace({ pathname: '/speak/tags/0', search: history.location.search });
		}
	}, [props.match]);

	if (roundware === null || !roundware.uiConfig) {
		return null;
	}

	return (
		<DraftRecordingProvider roundware={roundware}>
			<Grid container className={styles.rootFormContainer}>
				<Grid item className={styles.responsiveFormContainer} style={{ margin: 'auto' }} xs={12} sm={10} md={8} lg={6}>
					<Switch>
						<Route path={`${props.match.path}/tags/:tagGroupIndex`} component={TagSelectForm} />
						<Route path={`${props.match.path}/location`} component={LocationSelectForm} />
						<Route path={`${props.match.path}/recording`} component={finalConfig.speak.recordingMethod === 'standard' ? CreateRecordingForm : LoopingRecordingForm} />
					</Switch>
				</Grid>
			</Grid>
		</DraftRecordingProvider>
	);
};

export default SpeakPage;
