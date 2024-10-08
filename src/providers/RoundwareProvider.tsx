import moment from 'moment';
import * as React from 'react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { GeoListenMode, Roundware } from 'roundware-web-framework';
import { Coordinates, GeoListenModeType } from 'roundware-web-framework/dist/types';
import { IAssetData } from 'roundware-web-framework/dist/types/asset';
import { IRoundwareConstructorOptions } from 'roundware-web-framework/dist/types/roundware';
import RoundwareContext, { IRoundwareContext } from '../context/RoundwareContext';
import useDebounce from '../hooks/useDebounce';
import { useDeviceID } from '../hooks/useDeviceID';
import { ITagLookup } from '../types';

import config from 'config';

interface PropTypes {
	children: React.ReactNode;
}

const RoundwareProvider = (props: PropTypes) => {
	const [roundware, setRoundware] = useState<Roundware>({
		uiConfig: {
			speak: [],
		},
	} as unknown as Roundware);
	const [assetsReady, setAssetsReady] = useState<IRoundwareContext[`assetsReady`]>(false);
	const [beforeDateFilter, setBeforeDateFilter] = useState<IRoundwareContext[`beforeDateFilter`]>(new Date());
	const [afterDateFilter, setAfterDateFilter] = useState<IRoundwareContext[`afterDateFilter`]>(null);
	const [userFilter, setUserFilter] = useState<IRoundwareContext[`userFilter`]>('');
	const [selectedAsset, selectAsset] = useState<IRoundwareContext[`selectedAsset`]>(null);
	const [selectedTags, setSelectedTags] = useState<IRoundwareContext[`selectedTags`]>(null);
	const [descriptionFilter, setDescriptionFilter] = useState<IRoundwareContext[`descriptionFilter`]>(null);
	const debouncedDescriptionFilter = useDebounce(descriptionFilter, 800);
	const [sortField, setSortField] = useState<IRoundwareContext[`sortField`]>({ name: 'created', asc: false });
	const [assetPageIndex, setAssetPageIndex] = useState(0);
	const [assetsPerPage, setAssetsPerPage] = useState(10000);
	const [tagLookup, setTagLookup] = useState<IRoundwareContext[`tagLookup`]>({});
	const [filteredAssets, setFilteredAssets] = useState<IAssetData[]>([]);
	const deviceId = useDeviceID();
	const [assetPageNonMemoized, setAssetPage] = useState<IRoundwareContext[`assetPage`]>([]);
	const assetPage = useMemo(() => assetPageNonMemoized, [assetPageNonMemoized]);
	const [playingAssets, setPlayingAssets] = useState<IRoundwareContext[`playingAssets`]>([]);

	const [hideSpeakerPolygons, setHideSpeakerPolygons] = useState<IRoundwareContext[`hideSpeakerPolygons`]>(config.features.speakerToggleIds?.[0] ? [config.features.speakerToggleIds?.[0]] : []);

	const [, forceUpdate] = useReducer((x) => !x, false);

	const updatePlaying = (assets: IAssetData[] | undefined) => {
		const pa: IAssetData[] = Array.from(roundware?.mixer?.playlist?.trackMap.values() || []).filter((a) => a != null) as IAssetData[];
		setPlayingAssets(pa || []);
		console.log(`update playing: `, pa);
	};

	const sortAssets = (assets: IAssetData[]) => {
		const sort_value = sortField.asc ? 1 : -1;

		const sortEntries = (a: IAssetData, b: IAssetData) => {
			if (a[sortField.name]! > b[sortField.name]!) {
				return sort_value;
			}
			if (a[sortField.name]! < b[sortField.name]!) {
				return -Math.abs(sort_value);
			}
			return 0;
		};
		const sortedAssets = [...assets];
		sortedAssets.sort(sortEntries);
		return sortedAssets;
	};

	useEffect(() => {
		const sortedAssets = sortAssets(filteredAssets);
		if (sortedAssets.length < assetPageIndex * assetsPerPage) {
			setAssetPageIndex(0);
			return;
		}
		const page: IAssetData[] = sortedAssets.slice(assetPageIndex * assetsPerPage, assetPageIndex * assetsPerPage + assetsPerPage);
		setAssetPage(page);
		if (roundware.assetData) {
			setAssetsReady(true);
		}
	}, [filteredAssets, assetPageIndex, assetsPerPage, sortField.name, sortField.asc]);

	useEffect(() => {
		if (!roundware?.uiConfig?.speak) {
			return;
		}
		let tag_lookup: ITagLookup = {};
		roundware.uiConfig.speak.forEach((group) =>
			group.display_items.forEach((tag) => {
				tag_lookup[tag.id] = tag;
			})
		);
		setTagLookup(tag_lookup);
	}, [roundware?.uiConfig && roundware?.uiConfig?.speak]);

	const filterAssets = (asset_data: IAssetData[]) => {
		return asset_data.filter((asset) => {
			// show the asset, unless a filter returns 'false'

			if (config.map.assetTypeDisplay.includes(asset.media_type as (
				| 'audio'
				| 'photo'
				| 'text'
			)) == false) {
				return false;
			}


			// filter by tags first
			let filteredByTag = false;
			const tag_filter_groups = Object.entries(selectedTags || {});
			tag_filter_groups.forEach(([_filter_group, tags]: [_filter_group: string, tags: number[]]) => {
				if (filteredByTag) {
					// if we've already filtered out this asset based on another tag group, stop thinking about it
					return;
				}
				if (tags.length) {
					const hasMatch = tags.some((tag_id: number) => asset.tag_ids!.indexOf(tag_id) !== -1);
					if (!hasMatch) {
						filteredByTag = true;
					}
				}
			});
			if (filteredByTag) {
				return false;
			}
			// then filter by user
			if (userFilter.length) {
				let user_str = 'anonymous';
				if (asset.user) {
					user_str = asset.user && `${asset.user.username} ${asset.user.email}`;
				}
				const user_match = user_str.indexOf(userFilter) !== -1;
				if (!user_match) {
					return false;
				}
			}
			// then filter by start and end dates
			if (afterDateFilter && beforeDateFilter) {
				const dateMatch = asset.created! <= beforeDateFilter.toISOString() && asset.created! >= afterDateFilter.toISOString() ? true : false;

				if (!dateMatch) {
					return false;
				}
			}

			if (descriptionFilter) {
				const descMatch = asset.description?.toLowerCase().indexOf(descriptionFilter.toLowerCase()) !== -1;

				if (!descMatch) return false;
			}
			return true;
		});
	};
	// tells the provider to update assetData dependencies with the roundware _assetData source
	const updateAssets: IRoundwareContext[`updateAssets`] = (assetData) => {
		const filteredAssets = filterAssets(assetData || roundware.assetData || []);
		setFilteredAssets(filteredAssets);
	};

	useEffect(() => {
		if (roundware?.assetData) {
			const filteredAssets = filterAssets(roundware.assetData);
			setFilteredAssets(filteredAssets);
		}
	}, [roundware?.assetData, selectedTags, userFilter, afterDateFilter, beforeDateFilter, debouncedDescriptionFilter]);

	const selectTags: IRoundwareContext[`selectTags`] = (tags, group) => {
		setSelectedTags((prev) => {
			const group_key = group.group_short_name!;
			const newFilters = prev ? { ...prev } : {};
			let listenTagIds: number[] = [];
			if (tags == null && newFilters[group_key]) {
				delete newFilters[group_key];
			} else {
				newFilters[group_key] = tags!;
			}

			Object.keys(newFilters).map(function (key) {
				listenTagIds.push(...newFilters[key]);
			});

			roundware.mixer.updateParams({ listenTagIds: listenTagIds });
			roundware.events?.logEvent(`filter_stream`, {
				tag_ids: listenTagIds,
			});
			return newFilters;
		});
	};

	// when this provider is loaded, initialize roundware via api
	useEffect(() => {
		const project_id = config.project.id;
		const server_url = config.project.apiUrl;
		console.log(config.project);
		// maybe we build the site with a default listener location,
		// otherwise we go to null island

		// location from url params take precendence;
		const searchParams = new URLSearchParams(location.search);

		const urlLatitude = searchParams.get('latitude');
		const urlLongitude = searchParams.get('longitude');
		const initial_loc = {
			latitude: parseFloat(typeof urlLatitude == 'string' ? urlLatitude : (config.project.initialLocation.latitude || 0).toString()),
			longitude: parseFloat(typeof urlLongitude == 'string' ? urlLongitude : (config.project.initialLocation.longitude || 0).toString()),
		};

		const roundwareOptions: IRoundwareConstructorOptions = {
			deviceId: deviceId,
			serverUrl: server_url,
			projectId: project_id,
			geoListenMode: GeoListenMode.DISABLED,
			speakerFilters: { activeyn: true },
			assetFilters: { submitted: true, },
			listenerLocation: initial_loc,
			assetUpdateInterval: 30 * 1000,

			apiClient: undefined!,
			keepPausedAssets: config.listen.keepPausedAssets == true,
			speakerConfig: config.listen.speaker,
		};
		const roundware = new Roundware(window, roundwareOptions);

		roundware.connect().then(() => {
			// set the initial listener location to the project default
			if (!searchParams.has('latitude')) {
				// and when url params are not passed
				roundware.updateLocation(roundware.project.location);
			}
			roundware.onUpdateLocation = forceUpdate;
			roundware.onUpdateAssets = updateAssets;
			roundware.onPlayAssets = updatePlaying;
			setRoundware(roundware);
		});
	}, []);

	useEffect(() => {
		if (roundware.project && typeof roundware.loadAssetPool == 'function') {
			roundware?.loadAssetPool().then((data) => {
				setAssetsReady(true);
			});
		}
	}, [roundware?.project]);

	const geoListenMode = (roundware?.mixer && roundware?.mixer?.mixParams?.geoListenMode) || GeoListenMode?.DISABLED;
	const setGeoListenMode = (modeName: GeoListenModeType) => {
		roundware.enableGeolocation(modeName);
		let prom: Promise<Coordinates | void>;
		// console.log(`roundware.mixer.mixParams.geoListenMode: ${roundware.mixer.mixParams.geoListenMode}`);
		if (modeName === GeoListenMode.AUTOMATIC) {
			if (roundware.mixer) {
				roundware.mixer.updateParams({
					maxDist: roundware.project.recordingRadius,
					recordingRadius: roundware.project.recordingRadius,
				});
			}
		} else if (modeName === GeoListenMode.MANUAL) {
			// set maxDist to value calculated from range circle overlay
			prom = new Promise<void>((resolve, reject) => {
				resolve();
			});
			prom.then(forceUpdate);
		}
	};

	const resetFilters = () => {
		setAfterDateFilter(null);
		setBeforeDateFilter(null);
		setDescriptionFilter(null);
		setSelectedTags(null);
	};
	return (
		<RoundwareContext.Provider
			value={{
				roundware,
				// everything from the state
				tagLookup,
				sortField,
				selectedTags,
				selectedAsset,
				beforeDateFilter,
				afterDateFilter,
				assetPageIndex,
				assetsPerPage,
				geoListenMode,
				userFilter,
				playingAssets,
				descriptionFilter,
				// state modification functions
				selectAsset,
				selectTags,
				setUserFilter,
				setBeforeDateFilter,
				setAfterDateFilter,
				setAssetPageIndex,
				setAssetsPerPage,
				setSortField,
				forceUpdate,
				setGeoListenMode,
				updateAssets,
				setDescriptionFilter,
				resetFilters,
				// computed properties
				assetPage,
				assetsReady,
				hideSpeakerPolygons,
				setHideSpeakerPolygons,
			}}
		>
			{props.children}
		</RoundwareContext.Provider>
	);
};

export default RoundwareProvider;
