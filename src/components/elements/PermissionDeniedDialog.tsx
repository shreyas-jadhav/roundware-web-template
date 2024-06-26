import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import finalConfig from 'config';
import { getPermissionMessages, type Funcionality } from 'web-permission-messages';
import ImageErrorBoundary from './ImageErrorBoundary';
type Props = {
	open: boolean;
	onClose: () => void;
	functionality: Funcionality;
};

const PermissionDeniedDialog = (props: Props) => {
	const message = getPermissionMessages(props.functionality, {
		locale: finalConfig.locale as 'en' | 'es',
	});

	return (
		<Dialog open={props.open} onClose={props.onClose}>
			<DialogTitle>{message.deniedMessage}</DialogTitle>
			<DialogContent>
				<Stack
					spacing={1}
					component={'ol'}
					sx={{
						padding: 1,
						// no numbers
						'& li': {
							listStyleType: 'none',
							'&:before': {
								content: 'none',
							},
						},
					}}
				>
					{message.steps.map((step, index) => (
						<li key={step.message}>
							<Typography variant='h6'>
								{index + 1}. {step.message}
							</Typography>
							<ImageErrorBoundary>
								<Box
									component='img'
									sx={{
										minWidth: '320px',
										maxWidth: '100%',

										objectFit: 'contain',
										borderRadius: 4,
										borderWidth: 2,
										borderColor: (t) => t.palette.divider,
										borderStyle: 'solid',
									}}
									src={require(`web-permission-messages/dist/screenshots/${step.imageName}`)}
									alt={step.message}
								/>
							</ImageErrorBoundary>
						</li>
					))}
				</Stack>
			</DialogContent>

			<DialogActions>
				<Button onClick={props.onClose}>OK</Button>
			</DialogActions>
		</Dialog>
	);
};

export default PermissionDeniedDialog;
