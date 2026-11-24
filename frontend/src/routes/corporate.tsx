import { createRoute } from '@tanstack/react-router';
import { Route as RootRoute } from './__root';
import { SegmentLeadsPage } from '../components/SegmentLeadsPage';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/corporate',
  component: CorporateLeadsComponent,
});

function CorporateLeadsComponent() {
  return <SegmentLeadsPage segment="corporate" />;
}
