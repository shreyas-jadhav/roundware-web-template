// types for config file

export type IAssetCardConfig = {
	/** available */
	available: ('date' | 'tags' | 'description' | 'audio' | 'photo' | 'text' | 'actions')[];
	/** actions */
	actionItems: ('like' | 'flag' | 'download' | 'show')[];
};

export type IConfig = {
	locale: string;
	/** display debug mesages on UI */
	debugMode: boolean;

	/** project specific config */
	project: {
		/** url of the project's api */
		apiUrl: string;
		/** url of the project's server */
		serverUrl: string;
		/** id of the project to use */
		id: number;
		/** initial location to use; used to set initial map location */
		initialLocation: {
			latitude: number;
			longitude: number;
		};
	};
	/** config for listen mode */
	listen: {
		/**
		 * available listen modes user can switch between through out the app
		 * 'device' will use 'map' on desktop and 'walking' on mobile
		 *  */
		availableListenModes: 'device' | ('map' | 'walking')[];

		/** if an asset is paused, should it be kept paused after switching to another asset and resume when selected again */
		keepPausedAssets: boolean;
		/** default geo listen mode */
		geoListenMode: 'device' | ('map' | 'walking')[];
		/** clicking the 'Listen' button automatically starts the stream */
		autoplay: boolean;
		/** config for speaker */
		speaker: {
			/** all the speaker should be in sync */
			sync: boolean;
			/** should the speaker prefetch audio; user might need to wait */
			prefetch: boolean;
			/** should the speaker loop */
			loop: boolean;
			/** acceptable delay between two speaker when they are in sync;
			 * smaller the value, more accurate the sync
			 */
			acceptableDelayMs: number;
			/** interval at which the speaker should check if they are in sync
			 * smaller the value, more performance intensive,
			 * value should be in ms
			 */
			syncCheckInterval: number;
		};

		/** duration to skip when listen transport buttons are clicked */
		skipDuration: number;
	};
	/** config for speak mode */
	speak: {
		/** allow user to upload photos */
		allowPhotos: boolean;
		/** allow user to upload text */
		allowText: boolean;
		/** allow user to select tags */
		allowSpeakTags: boolean;
		/** default tags to be included regardless what user selects */
		defaultSpeakTags: number[];
	};
	/** config for map */
	map: {
		/** items to be displayed in the infowindow
		 * order will be the same as the order in the array
		 */
		infoWindowItems: IAssetCardConfig;

		/** zoom levels */
		zoom: {
			/** example when info window is selected */
			high: number;
			/** example when default loaded */
			low: number;
			/** when walking mode */
			walking: number;
		};
		/** how to display the speaker regions;
		 * 'images' will overlay the speaker region with the image "speaker.png" file
		 */
		speakerDisplay?: 'images' | 'polygons' | 'none';
		/** colors to be used for speaker polygons */
		speakerPolygonColors: string[];
		/** should the map area be restricted */
		useListenMapBounds: boolean;
		/** should the bounds markers be shown;  */
		showBoundsMarkers: boolean;
		/**
		 *  'none' will not restrict the map area
		 * 'auto' will restrict the map area to the bounds according to the speaker regions
		 */
		bounds: 'none' | 'auto';
		/**
		 * bounds points to be used when bounds is set to 'none'
		 * swLat: south west latitude
		 * swLng: south west longitude
		 * neLat: north east latitude
		 * neLng: north east longitude
		 * */
		boundsPoints: {
			swLat: number;
			swLng: number;
			neLat: number;
			neLng: number;
		};

		/** types of assets to be displayed */
		assetTypeDisplay: ('audio' | 'photo' | 'text')[];

		/** asset display */
		assetDisplay: 'pin' | 'circle' | 'polygon';
	};
	/** config for ui */
	ui: {
		/** height of the nav logo */
		navLogoHeight: number;

		/** side bar/drawer on listen page */
		listenSidebar: {
			/** should the sidebar be open by default on desktop */
			defaultOpen: boolean;
			/** should the sidebar be shown */
			active: boolean;
			filter: {
				/**
				 * filters available in the listen mode
				 * order will be the same as the order in the array
				 *  */
				active: boolean;
				available: ('date' | 'tags' | 'description')[];
			};
			history: {
				active: boolean;
				available: IAssetCardConfig;
				infoCardDefaultCollapsed: boolean;
			};
		};

		/** transport controls on listen page */
		listenTransport: {
			/** should the skip forward button be shown */
			includeSkipForwardButton: boolean;
			/** should the skip back button be shown */
			includeSkipBackButton: boolean;
		};
	};
	/** config for features usually project specific */
	features: {
		/** duration after which the app will automatically conclude the session */
		autoConcludeDuration: number;
		/** duration for which the app will conclude the session  */
		concludeDuration: number;
		/** link to the survey */
		surveyLink: string;
		/** time after which the app will automatically reset */
		autoResetTimeSeconds: number;

		/** ids of the tags which should toggle the speaker regions */
		speakerToggleIds: number[];
	};
};
