import Svg, { Path } from 'react-native-svg';

export function HomeIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        fill={color}
        d={[
          // House silhouette — peak + walls + rounded bottom corners
          'M12 2 L23 11.5 L21.5 11.5 L21.5 21.5 Q21.5 23 20 23 L4 23 Q2.5 23 2.5 21.5 L2.5 11.5 L1 11.5 Z',
          // Door cutout — rounded top
          'M9.5 23 L9.5 15.5 Q9.5 14 11 14 L13 14 Q14.5 14 14.5 15.5 L14.5 23 Z',
        ].join(' ')}
      />
    </Svg>
  );
}
