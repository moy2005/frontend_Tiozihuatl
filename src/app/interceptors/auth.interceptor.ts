import { HttpInterceptorFn } from '@angular/common/http';

/**
 * 🔐 Auth Interceptor (functional)
 * Agrega Authorization a backend
 * EXCLUYE Cloudinary para evitar CORS
 */
export const AuthInterceptor: HttpInterceptorFn = (req, next) => {

  // 🚫 NO interceptar Cloudinary
  if (req.url.includes('api.cloudinary.com')) {
    return next(req);
  }

  const token = localStorage.getItem('accessToken');

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next(authReq);
  }

  return next(req);
};












/*import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../api/services/auth';
import { catchError, switchMap, throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
    // 🚫 No interceptar peticiones a Cloudinary
  if (req.url.includes('api.cloudinary.com')) {
    return next.handle(req);
  }
  const accessToken = localStorage.getItem('accessToken');

  // 🔹 Añade el header Authorization automáticamente
  let cloned = req;
  if (accessToken) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` }
    });
  }

  // 🔹 Si el token expira, intenta renovar automáticamente
  return next(cloned).pipe(
    catchError((err) => {
      if (err.status === 401 && localStorage.getItem('refreshToken')) {
        return authService.refreshToken().pipe(
          switchMap((res: any) => {
            const newAccess = res?.accessToken;
            if (newAccess) {
              localStorage.setItem('accessToken', newAccess);
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newAccess}` },
              });
              return next(retryReq);
            }
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
*/