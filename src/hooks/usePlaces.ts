import { useCallback, useEffect, useState } from 'react';
import type { Place } from '../core/types';
import { loadPlaces, savePlaces } from '../services/storage';

export type PlaceDraft = Omit<Place, 'id'>;

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>(loadPlaces);

  useEffect(() => savePlaces(places), [places]);

  const add = useCallback((draft: PlaceDraft) => {
    setPlaces((ps) => [...ps, { ...draft, id: crypto.randomUUID() }]);
  }, []);
  const update = useCallback((id: string, draft: PlaceDraft) => {
    setPlaces((ps) => ps.map((p) => (p.id === id ? { ...draft, id } : p)));
  }, []);
  const remove = useCallback((id: string) => {
    setPlaces((ps) => ps.filter((p) => p.id !== id));
  }, []);

  return { places, add, update, remove };
}
