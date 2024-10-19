import configJSON from 'config.json';
import { IConfig } from 'configTypes';
import { merge } from 'lodash';

// this config object can be overridden by config.json
// Refer the type object below for info and comments on each config option
let config: IConfig = {
	locale: 'en',
	debugMode: false,

	project: {
		apiUrl: 'https://dev.roundware.com/api/2',
		serverUrl: 'https://dev.roundware.com/',
		id: 1,
		initialLocation: {
			latitude: 21.1458,
			longitude: 79.0882,
		},
	},

	listen: {
		availableListenModes: 'device',
		keepPausedAssets: true,
		geoListenMode: 'device',
		autoplay: false,
		speaker: {
			sync: false,
			prefetch: true,
			loop: true,
			acceptableDelayMs: 50,
			syncCheckInterval: 2500,
		},

		skipDuration: 5,
	},

	speak: {
		allowPhotos: true,
		allowText: true,
		allowSpeakTags: false,
		defaultSpeakTags: [],
		recordingMethod: 'looping',
	},

	map: {
		infoWindowItems: {
			available: ['date', 'tags', 'description', 'audio', 'photo', 'text', 'actions'],
			actionItems: ['like', 'flag', 'show'],
		},

		zoom: {
			high: 17,
			low: 11,
			walking: 22,
		},
		speakerDisplay: 'polygons',
		speakerPolygonColors: ['#044389', '#FCFF4B', '#FFAD05', '#7CAFC4', '#63A375', '#EF27A6'],
		useListenMapBounds: false,
		showBoundsMarkers: false,
		bounds: 'none',
		boundsPoints: {
			swLat: 3,
			swLng: 5,
			neLat: 5,
			neLng: 43,
		},
		assetTypeDisplay: ['audio', 'photo', 'text'],

		assetDisplay: 'circle',
	},

	ui: {
		navLogoHeight: 34,
		listenSidebar: {
			defaultOpen: false,
			active: true,
			filter: {
				active: true,
				available: ['date', 'tags', 'description'],
			},
			history: {
				active: true,
				available: {
					available: ['date', 'description', 'photo', 'text', 'audio', 'actions'],
					actionItems: ['show'],
				},
				infoCardDefaultCollapsed: false,
			},
		},

		listenTransport: {
			includeSkipForwardButton: false,
			includeSkipBackButton: false,
		},
	},

	features: {
		autoConcludeDuration: 992,
		concludeDuration: 2,
		surveyLink: 'https://forms.gle/nMfJNPozSW1KFddu7',
		autoResetTimeSeconds: 0,

		speakerToggleIds: [],
	},
};

// override the default config
// with values from a config.json file
let finalConfig: IConfig;
if (configJSON) {
	finalConfig = merge(config, configJSON);
} else finalConfig = config;

export default finalConfig;
