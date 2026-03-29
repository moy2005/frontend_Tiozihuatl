import { Component, Inject, PLATFORM_ID, OnInit,CUSTOM_ELEMENTS_SCHEMA,ViewEncapsulation} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../api/services/auth';
import { SmsService } from '../../api/services/sms';
import { BiometricService } from '../../api/services/biometric';
import { OauthService } from '../../api/services/oauth';
import { ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
   styleUrls: ['./login.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class LoginComponent implements OnInit {
  correo = '';
  contrasena = '';
  telefono = '';
  otp = '';
  cargando = false;
  otpEnviado = false;
  smsMode = false;
  transitioning = false;
  oauthLoading: 'google' | 'facebook' | null = null;
  private otpInputFocused = false; // Flag para evitar múltiples llamadas

  constructor(
    private auth: AuthService,
    private sms: SmsService,
    private bio: BiometricService,
    private oauth: OauthService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  @ViewChild('otpInput') otpInput!: ElementRef<HTMLInputElement>;

  irARegistro() {
    this.router.navigate(['/register']);
  }

// Método para sanitizar inputs y prevenir XSS
sanitizeInput(value: string): string {
  if (!value) return '';
  
  // Eliminar caracteres peligrosos
  return value
    .replace(/[<>]/g, '') // Elimina < y >
    .replace(/['"]/g, '') // Elimina comillas simples y dobles
    .replace(/javascript:/gi, '') // Elimina javascript:
    .replace(/on\w+=/gi, '') // Elimina eventos como onclick=
    .replace(/script/gi, '') // Elimina la palabra script
    .trim();
}

// Método para bloquear caracteres peligrosos en tiempo real
bloquearCaracteresPeligrosos(event: KeyboardEvent) {
  const caracteresProhibidos = ['<', '>', '"', "'", '`'];
  
  if (caracteresProhibidos.includes(event.key)) {
    event.preventDefault(); // ❌ Bloquea la tecla
  }
}


  togglePassword(input: HTMLInputElement) {
  input.type = input.type === 'password' ? 'text' : 'password';
}

  irARecuperacionContrasena() {
    console.log('Redirigiendo a /forgot-password');
    this.router.navigate(['/forgot-password']);
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Verificar si viene de un redirect OAuth
      this.checkOAuthRedirect();
    }
  }

  /** 🔍 Verificar si viene de OAuth y guardar datos */
  checkOAuthRedirect() {
    this.route.queryParams.subscribe((params) => {
      const accessToken = params['accessToken'];
      const refreshToken = params['refreshToken'];
      const nombre = params['nombre'];
      const correo = params['correo'];

      // Si hay tokens, es un redirect de OAuth exitoso
      if (accessToken && nombre) {
        console.log('✅ OAuth exitoso, guardando datos...');

        // Guardar tokens
        this.auth.storeSession({
          accessToken,
          refreshToken,
          user: {
            id: params['id'],
            rol: params['rol'],
            nombre,
            correo,
            metodo_autenticacion: correo?.includes('facebook_')
              ? 'Facebook'
              : correo?.includes('@gmail.com')
              ? 'Google'
              : 'OAuth',
          },
        });

        // Mostrar mensaje de bienvenida
        Swal.fire({
          icon: 'success',
          title: '¡Bienvenido!',
          text: `Has iniciado sesión como ${nombre}`,
          timer: 2000,
          showConfirmButton: false,
        });

        setTimeout(() => {
          this.router.navigate(['/perfil']);
        }, 2000);
      }

      // Manejar errores de OAuth
      const error = params['error'];
      if (error) {
        let errorMessage = 'Ocurrió un error en la autenticación';

        switch (error) {
          case 'email_required':
            errorMessage =
              'Facebook no proporcionó tu email. Por favor autoriza el permiso e intenta de nuevo.';
            break;
          case 'auth_cancelled':
            errorMessage = 'Autenticación cancelada';
            break;
          case 'invalid_user':
            errorMessage = 'Usuario inválido';
            break;
          case 'oauth_failed':
            errorMessage = 'Error en la autenticación. Intenta de nuevo.';
            break;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error de autenticación',
          text: errorMessage,
          confirmButtonColor: '#EF4444',
        });
      }
    });
  }

  // 🎯 Hook para dar foco automático cuando aparece el input OTP
  ngAfterViewChecked() {
    if (this.otpEnviado && this.otpInput && !this.otpInputFocused && !this.cargando) {
      this.otpInputFocused = true;
      this.focusOtp();
    }

    // Resetear flag cuando se oculta el OTP
    if (!this.otpEnviado && this.otpInputFocused) {
      this.otpInputFocused = false;
    }
  }

 rolSeleccionado = ''; // ✅ nuevo campo

 async loginPassword() {

  // Sanitizar inputs antes de validar
  this.correo = this.sanitizeInput(this.correo);
  //this.contrasena = this.sanitizeInput(this.contrasena);
  this.rolSeleccionado = this.sanitizeInput(this.rolSeleccionado);


  if (!this.correo || !this.contrasena || !this.rolSeleccionado) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Ingresa tu matrícula o correo, tu contraseña y selecciona tu rol.',
      confirmButtonColor: '#3B82F6',
    });
    return;
  }

  this.cargando = true;
  try {
    const res = await this.auth
      .login({
        credential: this.correo,
        contrasena: this.contrasena,
        rolSeleccionado: this.rolSeleccionado,
      })
      .toPromise();

    // === LOGIN EXITOSO ===
    const access = res?.accessToken || res?.token;

    if (access) {
      this.auth.storeSession(res);

      this.router.navigate(['/perfil']);
      return;
    }

    this.mostrarError('Credenciales inválidas o token no generado.');
  } catch (err: any) {
    const msg = err?.error?.error?.toString().toLowerCase() || '';

    // 🟥 1) Cuenta bloqueada actualmente
    if (msg.includes('bloqueada') || msg.includes('bloqueado')) {
      Swal.fire({
        icon: 'error',
        title: 'Cuenta bloqueada',
        text: err.error.error,
        confirmButtonColor: '#EF4444',
      });
      return;
    }

    // 🟥 2) Contraseña incorrecta
    if (msg.includes('contraseña incorrecta')) {
      Swal.fire({
        icon: 'warning',
        title: 'Contraseña incorrecta',
        text: 'La contraseña no coincide. Si fallas varias veces tu cuenta será bloqueada.',
        confirmButtonColor: '#F59E0B',
      });
      return;
    }

    // 🟥 3) Usuario no encontrado
    if (msg.includes('usuario no encontrado')) {
      Swal.fire({
        icon: 'info',
        title: 'Usuario no encontrado',
        text: 'No existe ningún usuario con esas credenciales.',
        confirmButtonColor: '#3B82F6',
      });
      return;
    }

    // 🟥 4) Rol inválido
    if (msg.includes('rol no coincide')) {
      Swal.fire({
        icon: 'info',
        title: 'Rol incorrecto',
        text: 'El rol seleccionado no pertenece a esta cuenta.',
        confirmButtonColor: '#3B82F6',
      });
      return;
    }

    // 🟥 5) Otros errores
    this.mostrarError(err?.error?.error || 'Error en el inicio de sesión.');

  } finally {
    this.cargando = false;
  }
}



  /** Cambiar modo entre contraseña y SMS */
  cambiarModoSMS(valor: boolean) {
    this.transitioning = true;
    this.otpInputFocused = false;
    setTimeout(() => {
      this.smsMode = valor;
      this.transitioning = false;
    }, 250);
  }

  /** Enviar OTP por SMS */
  async enviarSMS() {
  
    // Sanitizar teléfono
  this.telefono = this.sanitizeInput(this.telefono);

    if (!this.telefono || this.telefono.length < 8) {
      Swal.fire({
        icon: 'warning',
        title: 'Número inválido',
        text: 'Ingresa un número telefónico válido.',
        confirmButtonColor: '#3B82F6',
      });
      return;
    }

    this.cargando = true;
    this.otpInputFocused = false;
    try {
      const res = await this.sms.sendOTP({ telefono: this.telefono }).toPromise();
      this.otpEnviado = true;
      this.otp = '';

      await Swal.fire({
        icon: 'success',
        title: 'Código enviado',
        text: res?.message || 'Se envió un código a tu número registrado.',
        confirmButtonColor: '#16A34A',
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err: any) {
      const msg = err?.error?.error || 'Error al enviar SMS.';
      this.mostrarError(msg);
    } finally {
      this.cargando = false;
    }
  }

  /** Verificar código OTP */
  async verificarOTP() {
    if (!this.otp || this.otp.length !== 6) {
      Swal.fire({
        icon: 'info',
        title: 'Código incompleto',
        text: 'El código debe tener 6 dígitos.',
        confirmButtonColor: '#3B82F6',
      });
      return;
    }

    this.cargando = true;
    try {
      const res = await this.sms
        .verifyOTP({
          telefono: this.telefono,
          otp: this.otp,
        })
        .toPromise();

      console.log('📦 Respuesta del backend:', res);

      if (res?.success && res?.token) {
        this.auth.storeSession({
          accessToken: res.token,
          refreshToken: res.refreshToken,
          user: res.user,
        });

        Swal.fire({
          icon: 'success',
          title: '¡Bienvenido!',
          text: 'Autenticación por SMS exitosa.',
          timer: 1500,
          showConfirmButton: false,
        });

        this.router.navigate(['/perfil']);
      } else {
        this.otp = '';
        this.otpInputFocused = false;
        this.mostrarError('Código incorrecto o token no recibido.');
        setTimeout(() => this.focusOtp(), 300);
      }
    } catch (err: any) {
      this.otp = '';
      this.otpInputFocused = false;
      this.mostrarError(err?.error?.error || 'Error al verificar código.');
      setTimeout(() => this.focusOtp(), 300);
    } finally {
      this.cargando = false;
    }
  }

  /** Función mejorada para manejar input del OTP */
  onOtpInput(event: any) {
    const raw = (event?.target?.value ?? '').toString();
    const value = raw.replace(/\D/g, '').slice(0, 6);
    this.otp = value;

    if (event?.target) {
      event.target.value = value;
    }

    console.log('📝 OTP actual:', value, 'Longitud:', value.length);

    // ✅ Envío automático cuando se completan 6 dígitos
    if (value.length === 6 && !this.cargando) {
      console.log('✅ 6 dígitos completados, verificando...');
      setTimeout(() => {
        this.verificarOTP();
      }, 200);
    }
  }

  /** Función mejorada para manejar paste del OTP */
  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const value = text.replace(/\D/g, '').slice(0, 6);

    this.otp = value;

    const target = event.target as HTMLInputElement;
    if (target) {
      target.value = value;
    }

    console.log('📋 OTP pegado:', value, 'Longitud:', value.length);

    // ✅ Envío automático cuando se pega un código completo
    if (value.length === 6 && !this.cargando) {
      console.log('✅ Código completo pegado, verificando...');
      setTimeout(() => {
        this.verificarOTP();
      }, 200);
    }
  }

  /**  Dar foco al input OTP */
  focusOtp() {
    setTimeout(() => {
      if (this.otpInput?.nativeElement) {
        this.otpInput.nativeElement.focus();
        // Forzar el foco en iOS/Safari
        this.otpInput.nativeElement.click();
        console.log('🎯 Foco establecido en input OTP');
      }
    }, 100);
  }

  async loginBiometria() {
    this.cargando = true;
    try {
      console.log('🔐 Iniciando login biométrico...');
      const credential = this.sanitizeInput(this.correo.trim());

      if (!credential) {
        console.log('❌ Error: Credencial no proporcionada');
        Swal.fire({
          icon: 'info',
          title: 'Credencial requerida',
          text: 'Introduce tu matrícula o correo para continuar.',
          confirmButtonColor: '#3B82F6',
        });
        this.cargando = false;
        return;
      }

      console.log('🪪 Credencial:', credential);

      // Verificar soporte de WebAuthn
      if (!window.PublicKeyCredential) {
        console.log('❌ Error: El dispositivo no soporta WebAuthn');
        Swal.fire({
          icon: 'info',
          title: 'No soportado',
          text: 'Tu navegador no admite autenticación biométrica.',
          confirmButtonColor: '#3B82F6',
        });
        this.cargando = false;
        return;
      }

      // Obtener tipo de biometría configurada
      console.log('🔍 Obteniendo tipo de biometría configurada...');
      const tipoRes = await this.bio.obtenerTipoBiometria(credential).toPromise();
      console.log('✅ Tipo de biometría recibido:', tipoRes);

      if (!tipoRes || !tipoRes.metodo) {
        console.log('❌ Error: Biometría no configurada para este usuario');
        Swal.fire({
          icon: 'info',
          title: 'Biometría no configurada',
          text: 'Este usuario no tiene biometría registrada. Por favor, inicia sesión con contraseña.',
          confirmButtonColor: '#3B82F6',
        });
        this.cargando = false;
        return;
      }

      const tipo = tipoRes.metodo;
      console.log('🔐 Método biométrico:', tipo);

      // Obtener opciones de autenticación del servidor
      console.log('📋 Solicitando opciones de autenticación al servidor...');
      const options = await this.bio.authOptions({ credential, tipo }).toPromise();
      console.log('✅ Opciones de autenticación recibidas:', {
        challengeLength: options.challenge?.length,
        hasAllowCredentials: !!options.allowCredentials,
        credentialsCount: options.allowCredentials?.length,
      });

      // Convertir challenge de Base64 a ArrayBuffer
      const challengeArrayBuffer = this.base64ToArrayBuffer(options.challenge);
      console.log(
        '✅ Challenge convertido a ArrayBuffer, longitud:',
        challengeArrayBuffer.byteLength
      );

      // Convertir allowCredentials IDs
      if (options.allowCredentials && options.allowCredentials.length > 0) {
        options.allowCredentials = options.allowCredentials.map((cred: any) => ({
          ...cred,
          id: this.base64ToArrayBuffer(cred.id),
        }));
        console.log('✅ CredentialIds convertidos a ArrayBuffer');
      }

      // Solicitar autenticación biométrica
      console.log('🔑 Solicitando credencial biométrica al usuario...');
      let cred: any;
      try {
        cred = await navigator.credentials.get({
          publicKey: {
            ...options,
            challenge: challengeArrayBuffer,
          },
        });
        console.log('✅ Credencial biométrica obtenida');
      } catch (credError: any) {
        console.error('❌ Error al obtener credencial:', credError);
        const msg =
          credError?.name === 'NotAllowedError'
            ? 'Autenticación cancelada o biometría no reconocida.'
            : 'Error al acceder a la biometría del dispositivo.';
        Swal.fire({
          icon: 'error',
          title: 'Error biométrico',
          text: msg,
          confirmButtonColor: '#E53E3E',
        });
        this.cargando = false;
        return;
      }

      if (!cred) {
        console.log('❌ No se obtuvo credencial');
        Swal.fire({
          icon: 'warning',
          title: 'Sin credencial',
          text: 'No se pudo obtener la credencial biométrica.',
          confirmButtonColor: '#E53E3E',
        });
        this.cargando = false;
        return;
      }

      console.log('📦 Datos de credencial:', {
        id: cred.id.substring(0, 20) + '...',
        type: cred.type,
        rawIdLength: cred.rawId.byteLength,
      });

      // Preparar datos para enviar al servidor
      const assertionPayload = {
        credential,
        tipo,
        assertionResponse: {
          id: cred.id,
          rawId: this.arrayBufferToBase64(cred.rawId),
          type: cred.type,
          response: {
            clientDataJSON: this.arrayBufferToBase64(cred.response.clientDataJSON),
            authenticatorData: this.arrayBufferToBase64(cred.response.authenticatorData),
            signature: this.arrayBufferToBase64(cred.response.signature),
            userHandle: cred.response.userHandle
              ? this.arrayBufferToBase64(cred.response.userHandle)
              : null,
          },
        },
      };

      console.log('📤 Enviando datos de autenticación al servidor:', {
        credential: assertionPayload.credential,
        tipo: assertionPayload.tipo,
        credentialIdLength: assertionPayload.assertionResponse.id.length,
        rawIdLength: assertionPayload.assertionResponse.rawId.length,
        clientDataJSONLength: assertionPayload.assertionResponse.response.clientDataJSON.length,
        authenticatorDataLength:
          assertionPayload.assertionResponse.response.authenticatorData.length,
        signatureLength: assertionPayload.assertionResponse.response.signature.length,
      });

      // Enviar al servidor para verificación
 
if (!this.rolSeleccionado) {
  Swal.fire({
    icon: 'warning',
    title: 'Rol no seleccionado',
    text: 'Por favor selecciona tu rol antes de iniciar sesión biométrica.',
    confirmButtonColor: '#F59E0B',
  });
  this.cargando = false;
  return;
}

const payloadCompleto = {
  credential,
  rolSeleccionado: this.rolSeleccionado, 
  assertionResponse: assertionPayload.assertionResponse,
};

console.log('📤 Enviando datos de autenticación al servidor con rol:', this.rolSeleccionado);
const result = await this.bio.authenticate(payloadCompleto).toPromise();
console.log('✅ Resultado de autenticación:', result);


  if (result?.token || result?.accessToken) {
  this.auth.storeSession(result);

  // ✅ Guardar usuario si existe
  if (result.user) { /* ya persistido en AuthService */ }

  // ✅ Guardar refreshToken vacío para evitar errores en guards
  if (!localStorage.getItem('refreshToken')) { /* compatibilidad */ }

  Swal.fire({
    icon: 'success',
    title: '¡Bienvenido!',
    text:
      result.user?.metodo_autenticacion === 'Biometría'
        ? 'Autenticación con huella exitosa.'
        : 'Autenticación exitosa.',
    timer: 1500,
    showConfirmButton: false,
  });

  this.router.navigate(['/perfil']);


      } else {
        console.log('❌ Error: No se recibió token del servidor');
        this.mostrarError('Error en autenticación biométrica');
      }
    } catch (error: any) {
      console.error('❌ Error en el proceso de autenticación biométrica:', error);
      const errorMsg =
        error?.error?.error || error?.message || 'No se pudo completar la autenticación';
      Swal.fire({
        icon: 'error',
        title: 'Error en biometría',
        text: errorMsg,
        confirmButtonColor: '#E53E3E',
      });
    } finally {
      console.log('🏁 Finalizando proceso de login biométrico');
      this.cargando = false;
    }
  }

  /** Función para convertir Base64 a ArrayBuffer */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Normalizar Base64 URL-safe a Base64 estándar
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');

    // Agregar padding si es necesario
    while (base64.length % 4) {
      base64 += '=';
    }

    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  /** Función para convertir ArrayBuffer a Base64 */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /** ✅ Login OAuth sin popup (redirección directa) */
  async loginOAuth(provider: 'google' | 'facebook') {
    this.oauthLoading = provider;
    this.oauth.login(provider); // hace window.location.href = api/oauth/...
  }

  /** 🎨 Añade efecto de rebote al soltar el botón */
  addBounceEffect(event: Event) {
    const button = event.currentTarget as HTMLElement;
    button.classList.remove('released');
    void button.offsetWidth;
    button.classList.add('released');

    setTimeout(() => {
      button.classList.remove('released');
    }, 350);
  }

  /** Manejo unificado de errores */
  mostrarError(mensaje: string) {
    this.cargando = false;
    this.oauthLoading = null;
    Swal.fire({
      icon: 'error',
      title: 'Error de autenticación',
      text: mensaje,
      confirmButtonColor: '#E53E3E',
    });
  }
}
