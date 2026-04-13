/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const Home    = lazy(() => import('@pages/Home/Home'));
const Sandbox = lazy(() => import('@pages/Sandbox/Sandbox'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={null}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: '/sandbox',
    element: (
      <Suspense fallback={null}>
        <Sandbox />
      </Suspense>
    ),
  },
]);
