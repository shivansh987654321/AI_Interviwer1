package com.aiinterview.interceptor;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.UrlJwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;

// Clerk JWT verification — replaces the @clerk/express authenticate() middleware.
// Fetches the public key from Clerk's JWKS endpoint and verifies the RS256 signature.
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuthInterceptor.class);

    @Value("${clerk.jwks.url:}")
    private String clerkJwksUrl;

    @Value("${clerk.publishable.key:}")
    private String clerkPublishableKey;

    // Cached JWKS provider — fetches keys from Clerk once and caches them
    private JwkProvider jwkProvider;
    private boolean providerInitialized = false;

    // Build the JWKS URL from the Clerk publishable key if not explicitly set.
    // Clerk publishable keys encode the frontend API domain in base64.
    private String resolveJwksUrl() {
        if (clerkJwksUrl != null && !clerkJwksUrl.isEmpty()) {
            return clerkJwksUrl;
        }
        if (clerkPublishableKey != null && clerkPublishableKey.length() > 10) {
            try {
                // pk_test_<base64> or pk_live_<base64>
                String[] parts = clerkPublishableKey.split("_", 3);
                if (parts.length == 3) {
                    String encoded = parts[2];
                    // Pad to multiple of 4 bytes
                    while (encoded.length() % 4 != 0) encoded += "=";
                    String decoded = new String(Base64.getDecoder().decode(encoded)).replace("$", "");
                    return "https://" + decoded + "/.well-known/jwks.json";
                }
            } catch (Exception e) {
                log.warn("[Auth] Could not derive JWKS URL from publishable key: {}", e.getMessage());
            }
        }
        return null;
    }

    private JwkProvider getProvider() throws Exception {
        if (!providerInitialized) {
            String url = resolveJwksUrl();
            if (url != null && !url.isEmpty()) {
                jwkProvider = new UrlJwkProvider(new URL(url));
                log.info("[Auth] Clerk JWKS URL: {}", url);
            }
            providerInitialized = true;
        }
        return jwkProvider;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Allow OPTIONS (CORS preflight) through without auth
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendUnauthorized(response, "Unauthorized. Valid Clerk session required.");
            return false;
        }

        String token = authHeader.substring(7);

        try {
            JwkProvider provider = getProvider();

            if (provider != null) {
                // Full RS256 verification using Clerk's public key
                DecodedJWT decoded = JWT.decode(token);
                Jwk jwk = provider.get(decoded.getKeyId());
                Algorithm algorithm = Algorithm.RSA256((RSAPublicKey) jwk.getPublicKey(), null);
                DecodedJWT verified = JWT.require(algorithm).build().verify(token);
                String userId = verified.getSubject();
                if (userId == null || userId.isEmpty()) {
                    sendUnauthorized(response, "Unauthorized. Valid Clerk session required.");
                    return false;
                }
                // Make userId available to controllers via request attribute
                request.setAttribute("userId", userId);
            } else {
                // JWKS not configured — fall back to decoding payload only (dev mode)
                DecodedJWT decoded = JWT.decode(token);
                String userId = decoded.getSubject();
                if (userId == null || userId.isEmpty()) {
                    sendUnauthorized(response, "Unauthorized. Valid Clerk session required.");
                    return false;
                }
                request.setAttribute("userId", userId);
                log.debug("[Auth] Dev mode — JWT signature not verified (set clerk.jwks.url to enable)");
            }
            return true;
        } catch (Exception e) {
            log.warn("[Auth] JWT verification failed: {}", e.getMessage());
            sendUnauthorized(response, "Unauthorized. Valid Clerk session required.");
            return false;
        }
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
