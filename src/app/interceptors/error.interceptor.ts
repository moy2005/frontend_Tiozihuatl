import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const ErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {

      if (error.status === 400) {
        router.navigate(['/error/400']);
      }

      if (error.status === 500) {
        router.navigate(['/error/500']);
      }

      return throwError(() => error);
    })
  );
};
