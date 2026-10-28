import { MapView } from './map/MapView';
import { useTheme } from './hooks/useTheme';

export function App() {
  const [theme, toggle] = useTheme();
  return (
    <div className="fixed inset-0 overflow-hidden">
      <MapView
        theme={theme}
        hexes={null}
        hexState="none"
        places={[]}
        pin={null}
        fitBounds={null}
        fitKey=""
        padding={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onMapClick={(p) => console.log('click', p)}
      />
      <button onClick={toggle} className="absolute top-4 left-4 rounded-full bg-panel px-4 py-2">theme</button>
    </div>
  );
}
