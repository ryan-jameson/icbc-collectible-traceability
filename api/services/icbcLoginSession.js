// 工行扫码登录会话管理

const { randomUUID } = require('crypto');

const DEFAULT_SESSION_TTL_MS = parseInt(process.env.ICBC_LOGIN_SESSION_TTL || '300000', 10); // 5分钟

const sessions = new Map();

const sanitizeSession = (session) => {
	if (!session) {
		return null;
	}

	return {
		sessionId: session.sessionId,
		accountType: session.accountType,
		status: session.status,
		createdAt: new Date(session.createdAt).toISOString(),
		expiresAt: new Date(session.expiresAt).toISOString(),
		error: session.error || null
	};
};

const isExpired = (session) => {
	if (!session) {
		return true;
	}
	return session.expiresAt <= Date.now();
};

const cleanupExpiredSessions = () => {
	const now = Date.now();
	for (const [sessionId, session] of sessions.entries()) {
		if (session.expiresAt <= now || session.status === 'EXPIRED') {
			sessions.delete(sessionId);
		}
	}
};

setInterval(cleanupExpiredSessions, 60 * 1000).unref();

exports.createSession = ({ accountType, ttlMs = DEFAULT_SESSION_TTL_MS } = {}) => {
	const now = Date.now();
	const sessionId = randomUUID();
	const session = {
		sessionId,
		accountType,
		status: 'PENDING',
		createdAt: now,
		expiresAt: now + ttlMs,
		token: null,
		user: null,
		error: null
	};

	sessions.set(sessionId, session);

	return sanitizeSession(session);
};

exports.getSession = (sessionId, { includeSensitive = false } = {}) => {
	const session = sessions.get(sessionId);
	if (!session) {
		return null;
	}

	if (isExpired(session)) {
		session.status = 'EXPIRED';
		session.error = session.error || 'SESSION_EXPIRED';
	}

	if (includeSensitive) {
		return { ...session };
	}

	return sanitizeSession(session);
};

exports.markAuthorized = (sessionId, { token, user }) => {
	const session = sessions.get(sessionId);
	if (!session) {
		return null;
	}

	session.status = 'AUTHORIZED';
	session.token = token;
	session.user = user;
	session.error = null;

	return sanitizeSession(session);
};

exports.markFailed = (sessionId, errorCode, errorMessage) => {
	const session = sessions.get(sessionId);
	if (!session) {
		return null;
	}

	session.status = 'FAILED';
	session.error = errorCode || 'UNKNOWN_ERROR';
	if (errorMessage) {
		session.errorMessage = errorMessage;
	}

	return sanitizeSession(session);
};

exports.consumeAuthorizedSession = (sessionId) => {
	const session = sessions.get(sessionId);
	if (!session) {
		return null;
	}

	if (isExpired(session)) {
		session.status = 'EXPIRED';
		session.error = session.error || 'SESSION_EXPIRED';
		sessions.delete(sessionId);
		return null;
	}

	if (session.status !== 'AUTHORIZED' || !session.token || !session.user) {
		return null;
	}

	const payload = {
		token: session.token,
		user: session.user,
		sessionId: session.sessionId,
		accountType: session.accountType
	};

	sessions.delete(sessionId);
	return payload;
};

exports.clearSession = (sessionId) => {
	sessions.delete(sessionId);
};
