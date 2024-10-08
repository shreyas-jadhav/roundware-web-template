import { Mic } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useRoundware } from 'hooks/index';
import { Link } from 'react-router-dom';

const AddLoopVoiceButton = () => {
	const { roundware } = useRoundware();
	return (
		<Link
			to={{
				pathname: '/speak',
				search: `?lat=${roundware.listenerLocation.latitude}&lng=${roundware.listenerLocation.longitude}`,
			}}
		>
			<Button
				sx={{
					position: 'absolute',
					bottom: 0,
					left: '50%',
					transform: 'translate(-50%, -50%)',
					zIndex: 1000,
				}}
				variant='contained'
				size='large'
				startIcon={<Mic />}
			>
				Add your voice here
			</Button>
		</Link>
	);
};

export default AddLoopVoiceButton;
