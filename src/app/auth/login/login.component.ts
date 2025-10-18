import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth';
import { SmsService } from '../../services/sms';
import { BiometricService } from '../../services/biometric';
import { OauthService } from '../../services/oauth';
import { ElementRef, ViewChild } from '@angular/core';



@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
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

  /** Detectar redirección de OAuth (tokens en URL) */
  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const access = params['accessToken'];
      const refresh = params['refreshToken'];
      const nombre = params['nombre'];
      const correo = params['correo'];

      if (access) {
        localStorage.setItem('accessToken', access);
        if (refresh) localStorage.setItem('refreshToken', refresh);
        if (nombre && correo)
          localStorage.setItem('user', JSON.stringify({ nombre, correo }));

        // ✅ Redirige directamente al dashboard
        this.router.navigate(['/dashboard']);
      }

      // Si viene error desde backend OAuth
      if (params['error']) {
        Swal.fire({
          icon: 'error',
          title: 'Error en autenticación',
          text: params['error'],
          confirmButtonColor: '#E53E3E',
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

  /** Login con correo y contraseña */
  async loginPassword() {
    if (!this.correo || !this.contrasena) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Ingresa tu correo y contraseña.',
        confirmButtonColor: '#3B82F6',
      });
      return;
    }

    this.cargando = true;
    try {
      const res = await this.auth
        .login({ correo: this.correo, contrasena: this.contrasena })
        .toPromise();

      const access = res?.accessToken || res?.token;
      const refresh = res?.refreshToken;

      if (access) {
        localStorage.setItem('accessToken', access);
        if (refresh) localStorage.setItem('refreshToken', refresh);
        this.router.navigate(['/dashboard']);
      } else {
        this.mostrarError('Credenciales inválidas o token no generado.');
      }
    } catch (err: any) {
      const msg = err?.error?.error || 'Error en el inicio de sesión';
      this.mostrarError(msg);
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
        timerProgressBar: true
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
      const res = await this.sms.verifyOTP({
        telefono: this.telefono,
        otp: this.otp,
      }).toPromise();

      console.log("📦 Respuesta del backend:", res);

      if (res?.success && res?.token) {
        localStorage.setItem('accessToken', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));

        Swal.fire({
          icon: 'success',
          title: '¡Bienvenido!',
          text: 'Autenticación por SMS exitosa.',
          timer: 1500,
          showConfirmButton: false,
        });

        this.router.navigate(['/dashboard']);
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
    console.log("🔐 Iniciando login biométrico...");
    const correo = this.correo.trim();
    
    if (!correo) {
      console.log("❌ Error: Correo no proporcionado");
      Swal.fire({
        icon: 'info',
        title: 'Correo requerido',
        text: 'Introduce tu correo para continuar.',
        confirmButtonColor: '#3B82F6',
      });
      this.cargando = false;
      return;
    }

    console.log("📧 Correo:", correo);

    // Verificar soporte de WebAuthn
    if (!window.PublicKeyCredential) {
      console.log("❌ Error: El dispositivo no soporta WebAuthn");
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
    console.log("🔍 Obteniendo tipo de biometría configurada...");
    const tipoRes = await this.bio.obtenerTipoBiometria(correo).toPromise();
    console.log("✅ Tipo de biometría recibido:", tipoRes);

    if (!tipoRes || !tipoRes.metodo) {
      console.log("❌ Error: Biometría no configurada para este usuario");
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
    console.log("🔐 Método biométrico:", tipo);

    // Obtener opciones de autenticación del servidor
    console.log("📋 Solicitando opciones de autenticación al servidor...");
    const options = await this.bio.authOptions({ correo, tipo }).toPromise();
    console.log("✅ Opciones de autenticación recibidas:", {
      challengeLength: options.challenge?.length,
      hasAllowCredentials: !!options.allowCredentials,
      credentialsCount: options.allowCredentials?.length
    });

    // Convertir challenge de Base64 a ArrayBuffer
    const challengeArrayBuffer = this.base64ToArrayBuffer(options.challenge);
    console.log("✅ Challenge convertido a ArrayBuffer, longitud:", challengeArrayBuffer.byteLength);

    // Convertir allowCredentials IDs
    if (options.allowCredentials && options.allowCredentials.length > 0) {
      options.allowCredentials = options.allowCredentials.map((cred: any) => ({
        ...cred,
        id: this.base64ToArrayBuffer(cred.id)
      }));
      console.log("✅ CredentialIds convertidos a ArrayBuffer");
    }

    // Solicitar autenticación biométrica
    console.log("🔑 Solicitando credencial biométrica al usuario...");
    let cred: any;
    try {
      cred = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: challengeArrayBuffer
        }
      });
      console.log("✅ Credencial biométrica obtenida");
    } catch (credError: any) {
      console.error("❌ Error al obtener credencial:", credError);
      const msg = credError?.name === 'NotAllowedError'
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
      console.log("❌ No se obtuvo credencial");
      Swal.fire({
        icon: 'warning',
        title: 'Sin credencial',
        text: 'No se pudo obtener la credencial biométrica.',
        confirmButtonColor: '#E53E3E',
      });
      this.cargando = false;
      return;
    }

    console.log("📦 Datos de credencial:", {
      id: cred.id.substring(0, 20) + '...',
      type: cred.type,
      rawIdLength: cred.rawId.byteLength
    });

    // Preparar datos para enviar al servidor
    const assertionPayload = {
      correo,
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
            : null
        }
      }
    };

    console.log("📤 Enviando datos de autenticación al servidor:", {
      correo: assertionPayload.correo,
      tipo: assertionPayload.tipo,
      credentialIdLength: assertionPayload.assertionResponse.id.length,
      rawIdLength: assertionPayload.assertionResponse.rawId.length,
      clientDataJSONLength: assertionPayload.assertionResponse.response.clientDataJSON.length,
      authenticatorDataLength: assertionPayload.assertionResponse.response.authenticatorData.length,
      signatureLength: assertionPayload.assertionResponse.response.signature.length
    });

    // Enviar al servidor para verificación
    console.log("🔐 Verificando autenticación con el servidor...");
    const result = await this.bio.authenticate(assertionPayload).toPromise();
    console.log("✅ Resultado de autenticación:", result);

    if (result?.token || result?.accessToken) {
      const token = result.token || result.accessToken;
      console.log("✅ Token JWT recibido");
      localStorage.setItem('accessToken', token);
      
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
        console.log("✅ Datos de usuario guardados");
      }

      Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: tipo === 'HUELLA' 
          ? 'Autenticación con huella exitosa' 
          : 'Autenticación con PIN exitosa',
        timer: 1500,
        showConfirmButton: false
      });

      console.log("🚀 Redirigiendo al dashboard...");
      this.router.navigate(['/dashboard']);
    } else {
      console.log("❌ Error: No se recibió token del servidor");
      this.mostrarError('Error en autenticación biométrica');
    }
  } catch (error: any) {
    console.error("❌ Error en el proceso de autenticación biométrica:", error);
    const errorMsg = error?.error?.error || error?.message || 'No se pudo completar la autenticación';
    Swal.fire({
      icon: 'error',
      title: 'Error en biometría',
      text: errorMsg,
      confirmButtonColor: '#E53E3E',
    });
  } finally {
    console.log("🏁 Finalizando proceso de login biométrico");
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

