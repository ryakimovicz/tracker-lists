import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MusicDetailsModal } from './MusicDetailsModal';

export const MusicRouteModal: React.FC = () => {
  const params = useParams<{ type?: string; artist?: string; name?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Parse path parts:
  // e.g. /music/artist/:artist
  // e.g. /music/album/:artist/:name
  // e.g. /music/track/:artist/:name
  const pathParts = location.pathname.split('/').filter(Boolean);
  // pathParts: ['music', type, artist, ...rest]
  const rawType = params.type || (pathParts[0] === 'music' ? pathParts[1] : undefined);
  const type: 'artist' | 'album' | 'track' =
    rawType === 'artist' || rawType === 'album' || rawType === 'track'
      ? rawType
      : 'artist';

  let rawArtist = params.artist;
  let rawName = params.name;

  if (pathParts[0] === 'music') {
    if (!rawArtist && pathParts.length >= 3) {
      rawArtist = pathParts[2];
    }
    if (!rawName && pathParts.length >= 4) {
      rawName = pathParts.slice(3).join('/');
    }
  }

  const artist = rawArtist ? decodeURIComponent(rawArtist) : '';
  const name = rawName ? decodeURIComponent(rawName) : undefined;
  const initialImage = (location.state as any)?.image;

  const handleClose = () => {
    const bg = (location.state as any)?.backgroundLocation;
    if (bg) {
      const targetUrl = typeof bg === 'string' ? bg : `${bg.pathname || '/'}${bg.search || ''}${bg.hash || ''}`;
      navigate(targetUrl, { replace: true });
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/profile');
    }
  };

  if (!artist) {
    return null;
  }

  return (
    <MusicDetailsModal
      isOpen={true}
      onClose={handleClose}
      type={type}
      artist={artist}
      name={name}
      initialImage={initialImage}
    />
  );
};
