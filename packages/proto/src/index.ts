import * as path from 'path';

export const PROTO_PATHS = {
  AUTH: path.resolve(__dirname, '../proto/auth.proto'),
  CATALOG: path.resolve(__dirname, '../proto/catalog.proto'),
  INVENTORY: path.resolve(__dirname, '../proto/inventory.proto'),
  ORDER: path.resolve(__dirname, '../proto/order.proto'),
};

export const PROTO_PACKAGES = {
  AUTH: 'auth',
  CATALOG: 'catalog',
  INVENTORY: 'inventory',
  ORDER: 'order',
};

export const GRPC_SERVICES = {
  AUTH_SERVICE: 'AuthService',
  CATALOG_SERVICE: 'CatalogService',
  INVENTORY_SERVICE: 'InventoryService',
  ORDER_SERVICE: 'OrderService',
};
