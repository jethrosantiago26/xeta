const prefetchedRouteKeys = new Set()

const routeLoaders = {
  shop: () => Promise.all([
    import('../pages/ProductsPage.jsx'),
  ]),
  support: () => Promise.all([
    import('../pages/SupportPage.jsx'),
    import('../pages/FaqPage.jsx'),
  ]),
  orders: () => Promise.all([
    import('../pages/OrdersPage.jsx'),
  ]),
}

function prefetchRoute(routeKey) {
  const loader = routeLoaders[routeKey]

  if (!loader || prefetchedRouteKeys.has(routeKey)) {
    return
  }

  prefetchedRouteKeys.add(routeKey)

  loader().catch(() => {
    // Allow retry if a transient network failure interrupted chunk prefetch.
    prefetchedRouteKeys.delete(routeKey)
  })
}

export function prefetchShopRoutes() {
  prefetchRoute('shop')
}

export function prefetchSupportRoutes() {
  prefetchRoute('support')
}

export function prefetchOrdersRoute() {
  prefetchRoute('orders')
}
