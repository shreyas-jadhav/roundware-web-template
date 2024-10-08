import { GroundOverlay, GroundOverlayProps, useGoogleMap } from '@react-google-maps/api';
import getCenterOfMass from '@turf/center-of-mass';
import destination from '@turf/destination';
import distance from '@turf/distance';
import { point, Point, polygon, Position } from '@turf/helpers';
import midpoint from '@turf/midpoint';
import speakerImage from 'assets/speaker.png';
import { useRoundware } from 'hooks';
import React, { useMemo, useState } from 'react';
import { ISpeakerData } from 'roundware-web-framework/dist/types/speaker';
import { speakerPolygonColors as colors, speakerPolygonOptions } from 'styles/speaker';
interface Props {}

const getColorForIndex = (index: number): string => {
	return colors[index % colors.length];
};
const SpeakerImages = (props: Props) => {
	const { roundware, hideSpeakerPolygons } = useRoundware();

	const overlayProps: (GroundOverlayProps & {
		key: string;
	})[] = useMemo(() => {
		if (!Array.isArray(roundware.speakers())) return [];

		const p = roundware
			.speakers()
			?.sort((a, b) => (a?.id > b?.id ? -1 : 1))
			?.filter((speaker): speaker is ISpeakerData & Required<Pick<ISpeakerData, 'shape'>> => !!speaker.shape)
			?.filter((s) => !hideSpeakerPolygons.includes(s.id))
			.flatMap((s, index) => {
				const shape = polygon(s.shape.coordinates[0]);
				const coordinates = shape.geometry.coordinates[0];

				// get midpoints of all edges
				const midpoints: Point[] = [];

				for (let i = 0; i < coordinates.length - 1; i++) {
					const currentPoint = point(coordinates[i]);
					const nextPoint = point(coordinates[i + 1]);
					midpoints.push(midpoint(currentPoint, nextPoint).geometry);
				}

				// center of mass of polygon
				const centerOfMass = getCenterOfMass(shape).geometry.coordinates;

				// distances from center of mass to each midpoint
				const distances: number[] = [];

				midpoints.forEach((m) =>
					distances.push(
						distance(centerOfMass, m.coordinates, {
							units: 'degrees',
						})
					)
				);

				// take mean distance
				const avgDistance = (Math.min(...distances) + Math.max(...distances)) / 2;

				// find square points
				const squarePoints: Position[] = [];

				for (let i = 0; i < 4; i++) {
					squarePoints.push(
						destination(centerOfMass, avgDistance, 90 * i + 45, {
							units: 'degrees',
						}).geometry.coordinates
					);
				}

				const prop: GroundOverlayProps & {
					key: string;
				} = {
					bounds: new google.maps.LatLngBounds(new google.maps.LatLng(squarePoints[2][1], squarePoints[2][0]), new google.maps.LatLng(squarePoints[0][1], squarePoints[0][0])),
					url: speakerImage,
					options: {
						opacity: 0.2,
					},
					key: speakerImage + JSON.stringify(squarePoints),
				};

				return [prop];
			});

		return p;
	}, [speakerPolygonOptions, hideSpeakerPolygons]);

	return (
		<>
			{Array.isArray(overlayProps) &&
				overlayProps.map((p) => {
					return <GroundOverlay {...p} key={p.key} />;
				})}
		</>
	);
};

export default SpeakerImages;
