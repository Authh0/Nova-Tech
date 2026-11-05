import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { divIcon, type LatLngExpression } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import type { CollectionPoint } from '../types';

export interface CollectionMapProps {
  points: CollectionPoint[];
  selectedId?: string;
  onSelect?: (point: CollectionPoint) => void;
  userLocation?: { lat: number; lng: number } | null;
  height?: string | number;
  className?: string;
}

const PALMAS_CENTER: LatLngExpression = [-10.184, -48.333];

function pinIcon(selected: boolean) {
  return divIcon({
    className: 'ecotech-map-pin',
    html: `<span aria-hidden="true" style="display:block;width:${selected ? 22 : 18}px;height:${selected ? 22 : 18}px;border-radius:999px;background:${selected ? '#c75013' : '#e96925'};border:3px solid #fff;box-shadow:0 4px 12px rgba(24,37,34,.24)"></span>`,
    iconSize: [selected ? 22 : 18, selected ? 22 : 18],
    iconAnchor: [selected ? 11 : 9, selected ? 11 : 9],
    popupAnchor: [0, selected ? -12 : -10],
  });
}

function MapViewport({ selectedPoint }: { selectedPoint?: CollectionPoint }) {
  const map = useMap();

  useEffect(() => {
    if (selectedPoint) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], Math.max(map.getZoom(), 14), {
        duration: 0.45,
      });
    }
  }, [map, selectedPoint]);

  return null;
}

export function CollectionMap({
  points,
  selectedId,
  onSelect,
  userLocation,
  height = '520px',
  className,
}: CollectionMapProps) {
  const selectedPoint = points.find((point) => point.id === selectedId);
  const center = useMemo<LatLngExpression>(() => {
    if (selectedPoint) return [selectedPoint.lat, selectedPoint.lng];
    if (!points.length) return PALMAS_CENTER;
    const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
    return [lat, lng];
  }, [points, selectedPoint]);

  return (
    <div
      className={className}
      style={{ height, minHeight: 320, overflow: 'hidden', borderRadius: 20, position: 'relative' }}
      aria-label="Mapa dos pontos de coleta"
    >
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport selectedPoint={selectedPoint} />
        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={pinIcon(point.id === selectedId)}
            eventHandlers={{
              click: () => onSelect?.(point),
            }}
          >
            <Popup>
              <div style={{ minWidth: 190 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>{point.name}</strong>
                <span style={{ display: 'block', color: '#586762', fontSize: 13 }}>
                  {point.category} · {point.open ? 'Aberto agora' : 'Fechado agora'}
                </span>
                <span style={{ display: 'block', color: '#586762', fontSize: 13, marginTop: 4 }}>
                  {point.address}, {point.district}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                  {onSelect ? <button
                      type="button"
                      onClick={() => onSelect(point)}
                      style={{ border: 0, padding: 0, color: '#c75013', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Selecionar ponto
                    </button> : null}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir rota para ${point.name}`}
                    style={{ color: '#586762', display: 'inline-flex' }}
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        {userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={divIcon({
            className: 'ecotech-user-pin',
            html: '<span aria-hidden="true" style="display:block;width:14px;height:14px;border-radius:999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.32)"></span>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })}>
            <Popup>Sua localização aproximada</Popup>
          </Marker>
        ) : null}
      </MapContainer>
      {!points.length ? (
        <div
          className="empty-state"
          style={{ position: 'absolute', inset: 16, zIndex: 500, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}
        >
          <div>
            <MapPin size={22} aria-hidden="true" />
            <p>Nenhum ponto corresponde aos filtros.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CollectionMap;
