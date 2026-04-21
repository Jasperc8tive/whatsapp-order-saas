export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  OrderDetails: { orderId: string };
  CustomerProfile: { customerId: string };
  CustomerForm: { customerId?: string } | undefined;
  ProductForm: { productId?: string } | undefined;
  TeamManagement: undefined;
  Billing: undefined;
  AIDrafts: undefined;
  Analytics: undefined;
  Marketing: undefined;
  CampaignHistory: undefined;
  Inventory: undefined;
  Loyalty: undefined;
  Marketplace: undefined;
  VoiceCapture: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Orders: undefined;
  Customers: undefined;
  Products: undefined;
  Delivery: undefined;
  Settings: undefined;
};
