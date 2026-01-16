import { describe, expect, test } from 'bun:test'
import {
	REDACTED,
	REDACTION_RULES,
	SENSITIVE_FIELDS,
	SENSITIVE_PATTERNS,
	isSensitiveField,
	redactRecord,
	redactValue,
} from '../../src/logging/redact'

describe('REDACTED constant', () => {
	test('has expected value', () => {
		expect(REDACTED).toBe('[REDACTED]')
	})
})

describe('SENSITIVE_FIELDS', () => {
	test('includes common sensitive field names', () => {
		expect(SENSITIVE_FIELDS).toContain('password')
		expect(SENSITIVE_FIELDS).toContain('token')
		expect(SENSITIVE_FIELDS).toContain('secret')
		expect(SENSITIVE_FIELDS).toContain('key')
		expect(SENSITIVE_FIELDS).toContain('authorization')
		expect(SENSITIVE_FIELDS).toContain('cookie')
		expect(SENSITIVE_FIELDS).toContain('credentials')
	})

	test('includes API key variants', () => {
		expect(SENSITIVE_FIELDS).toContain('apiKey')
		expect(SENSITIVE_FIELDS).toContain('api_key')
		expect(SENSITIVE_FIELDS).toContain('apikey')
	})

	test('includes token variants', () => {
		expect(SENSITIVE_FIELDS).toContain('accessToken')
		expect(SENSITIVE_FIELDS).toContain('access_token')
		expect(SENSITIVE_FIELDS).toContain('refreshToken')
		expect(SENSITIVE_FIELDS).toContain('refresh_token')
	})

	test('includes key variants', () => {
		expect(SENSITIVE_FIELDS).toContain('privateKey')
		expect(SENSITIVE_FIELDS).toContain('private_key')
	})

	test('includes session variants', () => {
		expect(SENSITIVE_FIELDS).toContain('sessionId')
		expect(SENSITIVE_FIELDS).toContain('session_id')
	})
})

describe('SENSITIVE_PATTERNS', () => {
	test('is an array of RegExp', () => {
		expect(Array.isArray(SENSITIVE_PATTERNS)).toBe(true)
		for (const pattern of SENSITIVE_PATTERNS) {
			expect(pattern).toBeInstanceOf(RegExp)
		}
	})

	test('has multiple patterns defined', () => {
		expect(SENSITIVE_PATTERNS.length).toBeGreaterThan(5)
	})
})

describe('REDACTION_RULES', () => {
	test('has fields property', () => {
		expect(REDACTION_RULES.fields).toBeDefined()
		expect(REDACTION_RULES.fields).toBe(SENSITIVE_FIELDS)
	})

	test('has patterns property', () => {
		expect(REDACTION_RULES.patterns).toBeDefined()
		expect(REDACTION_RULES.patterns).toBe(SENSITIVE_PATTERNS)
	})
})

describe('isSensitiveField', () => {
	describe('detects sensitive fields', () => {
		test('detects password', () => {
			expect(isSensitiveField('password')).toBe(true)
		})

		test('detects token', () => {
			expect(isSensitiveField('token')).toBe(true)
		})

		test('detects secret', () => {
			expect(isSensitiveField('secret')).toBe(true)
		})

		test('detects key', () => {
			expect(isSensitiveField('key')).toBe(true)
		})

		test('detects authorization', () => {
			expect(isSensitiveField('authorization')).toBe(true)
		})

		test('detects apiKey', () => {
			expect(isSensitiveField('apiKey')).toBe(true)
		})

		test('detects accessToken', () => {
			expect(isSensitiveField('accessToken')).toBe(true)
		})
	})

	describe('case insensitive matching', () => {
		test('detects PASSWORD (uppercase)', () => {
			expect(isSensitiveField('PASSWORD')).toBe(true)
		})

		test('detects Password (mixed case)', () => {
			expect(isSensitiveField('Password')).toBe(true)
		})

		test('detects APIKEY (uppercase)', () => {
			expect(isSensitiveField('APIKEY')).toBe(true)
		})

		test('detects ApiKey (mixed case)', () => {
			expect(isSensitiveField('ApiKey')).toBe(true)
		})
	})

	describe('non-sensitive fields', () => {
		test('allows username', () => {
			expect(isSensitiveField('username')).toBe(false)
		})

		test('allows email', () => {
			expect(isSensitiveField('email')).toBe(false)
		})

		test('allows name', () => {
			expect(isSensitiveField('name')).toBe(false)
		})

		test('allows id', () => {
			expect(isSensitiveField('id')).toBe(false)
		})

		test('allows data', () => {
			expect(isSensitiveField('data')).toBe(false)
		})

		test('allows url', () => {
			expect(isSensitiveField('url')).toBe(false)
		})
	})

	describe('additionalFields option', () => {
		test('detects custom sensitive field', () => {
			expect(isSensitiveField('customSecret', ['customSecret'])).toBe(true)
		})

		test('detects custom field case insensitively', () => {
			expect(isSensitiveField('CUSTOMSECRET', ['customSecret'])).toBe(true)
		})

		test('still detects built-in fields with additional fields', () => {
			expect(isSensitiveField('password', ['custom'])).toBe(true)
		})

		test('allows non-matching custom field', () => {
			expect(isSensitiveField('username', ['customSecret'])).toBe(false)
		})
	})
})

describe('redactValue', () => {
	describe('redacts sensitive patterns', () => {
		test('redacts Bearer token', () => {
			const value = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('redacts Basic auth', () => {
			const value = 'Basic dXNlcm5hbWU6cGFzc3dvcmQ='
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('redacts JWT token', () => {
			const value =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('redacts OpenAI API key', () => {
			const value = 'sk-abcdefghijklmnopqrstuvwxyz123456'
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('redacts GitHub token', () => {
			const value = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890'
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('redacts Slack token', () => {
			const value = 'xoxb-123456789012-1234567890123-abcdefghij'
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('redacts AWS access key', () => {
			const value = 'AKIAIOSFODNN7EXAMPLE'
			expect(redactValue(value)).toBe(REDACTED)
		})

		test('preserves long hex strings (not over-redacted)', () => {
			// Generic hex patterns like UUIDs, git SHAs should NOT be redacted
			// to avoid over-redaction of debugging-useful information
			const value = 'abcdef1234567890abcdef1234567890'
			expect(redactValue(value)).toBe(value)
		})
	})

	describe('preserves non-sensitive values', () => {
		test('preserves regular string', () => {
			expect(redactValue('hello world')).toBe('hello world')
		})

		test('preserves short string', () => {
			expect(redactValue('abc')).toBe('abc')
		})

		test('preserves URL without credentials', () => {
			expect(redactValue('https://example.com/path')).toBe(
				'https://example.com/path',
			)
		})

		test('preserves number', () => {
			expect(redactValue(12345)).toBe(12345)
		})

		test('preserves boolean', () => {
			expect(redactValue(true)).toBe(true)
		})

		test('preserves null', () => {
			expect(redactValue(null)).toBe(null)
		})

		test('preserves undefined', () => {
			expect(redactValue(undefined)).toBe(undefined)
		})

		test('preserves object (not deep)', () => {
			const obj = { a: 1 }
			expect(redactValue(obj)).toBe(obj)
		})

		test('preserves array (not deep)', () => {
			const arr = [1, 2, 3]
			expect(redactValue(arr)).toBe(arr)
		})
	})

	describe('custom placeholder option', () => {
		test('uses custom placeholder', () => {
			const value = 'Bearer token123'
			expect(redactValue(value, { placeholder: '***' })).toBe('***')
		})
	})

	describe('additionalPatterns option', () => {
		test('detects custom pattern', () => {
			const customPattern = /secret-[a-z]+/
			expect(
				redactValue('secret-abc', { additionalPatterns: [customPattern] }),
			).toBe(REDACTED)
		})

		test('still detects built-in patterns with additional patterns', () => {
			const customPattern = /custom-[a-z]+/
			expect(
				redactValue('Bearer token123', { additionalPatterns: [customPattern] }),
			).toBe(REDACTED)
		})
	})
})

describe('redactRecord', () => {
	describe('redacts by field name', () => {
		test('redacts password field', () => {
			const input = { user: 'john', password: 'secret123' }
			const result = redactRecord(input)
			expect(result.user).toBe('john')
			expect(result.password).toBe(REDACTED)
		})

		test('redacts token field', () => {
			const input = { id: 1, token: 'abc123' }
			const result = redactRecord(input)
			expect(result.id).toBe(1)
			expect(result.token).toBe(REDACTED)
		})

		test('redacts apiKey field', () => {
			const input = { name: 'test', apiKey: 'key123' }
			const result = redactRecord(input)
			expect(result.name).toBe('test')
			expect(result.apiKey).toBe(REDACTED)
		})

		test('redacts authorization field', () => {
			const input = { url: '/api', authorization: 'Bearer xyz' }
			const result = redactRecord(input)
			expect(result.url).toBe('/api')
			expect(result.authorization).toBe(REDACTED)
		})
	})

	describe('redacts by value pattern', () => {
		test('redacts JWT in non-sensitive field', () => {
			const input = {
				data: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
			}
			const result = redactRecord(input)
			expect(result.data).toBe(REDACTED)
		})

		test('redacts Bearer token in value', () => {
			const input = { header: 'Bearer abc123xyz' }
			const result = redactRecord(input)
			expect(result.header).toBe(REDACTED)
		})
	})

	describe('handles nested objects', () => {
		test('redacts nested password field', () => {
			const input = {
				user: {
					name: 'john',
					password: 'secret',
				},
			}
			const result = redactRecord(input)
			expect(result.user.name).toBe('john')
			expect(result.user.password).toBe(REDACTED)
		})

		test('redacts deeply nested sensitive fields', () => {
			const input = {
				level1: {
					level2: {
						level3: {
							apiKey: 'key123',
							data: 'safe',
						},
					},
				},
			}
			const result = redactRecord(input)
			expect(result.level1.level2.level3.apiKey).toBe(REDACTED)
			expect(result.level1.level2.level3.data).toBe('safe')
		})
	})

	describe('handles arrays', () => {
		test('redacts objects in array', () => {
			const input = {
				users: [
					{ name: 'john', password: 'pass1' },
					{ name: 'jane', password: 'pass2' },
				],
			}
			const result = redactRecord(input)
			expect(result.users[0].name).toBe('john')
			expect(result.users[0].password).toBe(REDACTED)
			expect(result.users[1].name).toBe('jane')
			expect(result.users[1].password).toBe(REDACTED)
		})

		test('redacts sensitive patterns in array values', () => {
			const input = {
				tokens: ['Bearer abc', 'Bearer xyz'],
			}
			const result = redactRecord(input)
			expect(result.tokens[0]).toBe(REDACTED)
			expect(result.tokens[1]).toBe(REDACTED)
		})

		test('preserves non-sensitive array values', () => {
			const input = {
				names: ['john', 'jane'],
			}
			const result = redactRecord(input)
			expect(result.names[0]).toBe('john')
			expect(result.names[1]).toBe('jane')
		})
	})

	describe('additionalFields option', () => {
		test('redacts custom sensitive field', () => {
			const input = { customSecret: 'value', other: 'safe' }
			const result = redactRecord(input, {
				additionalFields: ['customSecret'],
			})
			expect(result.customSecret).toBe(REDACTED)
			expect(result.other).toBe('safe')
		})
	})

	describe('additionalPatterns option', () => {
		test('redacts custom pattern in value', () => {
			const input = { data: 'internal-secret-abc' }
			const result = redactRecord(input, {
				additionalPatterns: [/internal-secret-[a-z]+/],
			})
			expect(result.data).toBe(REDACTED)
		})
	})

	describe('custom placeholder option', () => {
		test('uses custom placeholder for field-based redaction', () => {
			const input = { password: 'secret' }
			const result = redactRecord(input, { placeholder: '***' })
			expect(result.password).toBe('***')
		})

		test('uses custom placeholder for pattern-based redaction', () => {
			const input = { data: 'Bearer token' }
			const result = redactRecord(input, { placeholder: '[HIDDEN]' })
			expect(result.data).toBe('[HIDDEN]')
		})
	})

	describe('preserves non-sensitive data', () => {
		test('preserves all safe fields', () => {
			const input = {
				id: 123,
				name: 'john',
				email: 'john@example.com',
				active: true,
				count: 42,
			}
			const result = redactRecord(input)
			expect(result).toEqual(input)
		})

		test('creates new object (does not mutate)', () => {
			const input = { password: 'secret' }
			const result = redactRecord(input)
			expect(result).not.toBe(input)
			expect(input.password).toBe('secret')
		})
	})
})
