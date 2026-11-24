import { createRoute } from '@tanstack/react-router';
import { Route as RootRoute } from './__root';
import { SegmentLeadsPage } from '../components/SegmentLeadsPage';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/universities',
  component: UniversitiesLeadsComponent,
});

function UniversitiesLeadsComponent() {
  return <SegmentLeadsPage segment="university" />;
}
