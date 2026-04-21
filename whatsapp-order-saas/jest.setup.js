// Polyfill URL.revokeObjectURL for tests (jsdom does not provide it)
if (typeof window !== 'undefined' && !window.URL.revokeObjectURL) {
	window.URL.revokeObjectURL = jest.fn();
}
// Polyfill TextEncoder for Next.js/Jest
if (typeof global.TextEncoder === 'undefined') {
	global.TextEncoder = require('util').TextEncoder;
}
require('@testing-library/jest-dom');

// Mock Supabase client modules for Jest
jest.mock('@/lib/supabaseClient', () => ({
	supabase: {
		auth: {
			signInWithPassword: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			signUp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			signOut: jest.fn(() => Promise.resolve({})),
			getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
		},
		from: jest.fn(() => ({
			select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: {}, error: null })) })) })),
			insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			update: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			delete: jest.fn(() => Promise.resolve({ data: {}, error: null })),
		})),
	},
}));

jest.mock('@/lib/supabaseAdmin', () => ({
	createAdminClient: jest.fn(() => ({
		auth: {
			signInWithPassword: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			signUp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			signOut: jest.fn(() => Promise.resolve({})),
			getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
		},
		from: jest.fn(() => ({
			select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: {}, error: null })) })) })),
			insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			update: jest.fn(() => Promise.resolve({ data: {}, error: null })),
			delete: jest.fn(() => Promise.resolve({ data: {}, error: null })),
		})),
	})),
}));

// Mock process.env for required env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_xxx';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_xxx';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.OPENAI_MODEL = 'gpt-4o-mini';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-wa-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890123456';
process.env.WHATSAPP_API_VERSION = 'v19.0';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
process.env.WORKER_SECRET = 'test-worker-secret';

// Polyfill URL.createObjectURL for tests (jsdom does not provide it)
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
	window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
}

// Mock Next.js app router hooks for modal/component tests
jest.mock('next/navigation', () => ({
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
		prefetch: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		refresh: jest.fn(),
		pathname: '/test',
		query: {},
	}),
	usePathname: () => '/test',
	useSearchParams: () => ({ get: jest.fn(), set: jest.fn() }),
	useParams: () => ({}),
	useSelectedLayoutSegments: () => [],
}));
