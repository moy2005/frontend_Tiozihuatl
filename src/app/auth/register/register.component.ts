import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../api/services/auth';
import { BiometricService } from '../../api/services/biometric';
import { OauthService } from '../../api/services/oauth';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';


interface PublicKeyCredential {
  id: string;
  rawId: ArrayBuffer;
  response: {
    clientDataJSON: ArrayBuffer | string;
    attestationObject?: any;
    signature?: any;
  };
  type: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  step: 1 | 2 | 3 = 1;
  cargando = false;
  oauthLoading: 'google' | 'facebook' | null = null;

  codigoVerificacion = '';
  correoPreRegistro = '';
  esperandoCodigo = false;


  form = {
    nombre: '',
    apaterno: '',
    amaterno: '',
    correo: '',
    telefono: '',
    contrasena: '',
    confirmPassword: '',
    palabra_secreta: '',
  };

  emailValid: boolean | null = null;
  emailExists = false;
  phoneValid: boolean | null = null;
  phoneExists = false;
  passwordStage = 0;
  showPasswordTip = false;
  enrollBiometria = false;
  tipoBiometria: 'HUELLA' | null = null; // solo HUELLA ahora

  private uppercaseRegex = /[A-Z]/;
  private lowercaseRegex = /[a-z]/;
  private numberRegex = /\d/;
  private specialCharRegex = /[@$!%*?&]/;

  constructor(
    private auth: AuthService,
    private bio: BiometricService,
    private oauth: OauthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  hasUppercase(): boolean {
    return this.uppercaseRegex.test(this.form.contrasena);
  }

  hasLowercase(): boolean {
    return this.lowercaseRegex.test(this.form.contrasena);
  }

  hasNumber(): boolean {
    return this.numberRegex.test(this.form.contrasena);
  }

  hasSpecialChar(): boolean {
    return this.specialCharRegex.test(this.form.contrasena);
  }

  ngOnInit() {
  this.route.queryParams.subscribe(params => {
if (params['skip'] === '1') {
  console.log("🔵 Registro reanudado tras verificar correo");

  this.step = 2;

  this.emailValid = true;
  this.phoneValid = true;

  // Recuperar el correo guardado en pre-registro
  const correoGuardado = localStorage.getItem('correoPreRegistro');
  if (correoGuardado) {
    this.form.correo = correoGuardado;
  }
}

  });
}



async nextStep() {
  if (this.step === 1) {
    if (!this.validarDatosPersonales()) return;

    try {
      // 1️⃣ Crear pre-registro
      const res: any = await this.auth.preRegistro({
        nombre: this.form.nombre,
        apaterno: this.form.apaterno,
        amaterno: this.form.amaterno,
        correo: this.form.correo,
        telefono: this.form.telefono
      }).toPromise();

      Swal.fire({
        icon: 'info',
        title: 'Verifica tu correo',
        text: 'Te enviamos un enlace de verificación. Revisa tu bandeja de entrada.',
        confirmButtonText: 'OK'
      });

      // Guardamos el correo por si el backend lo necesita al regresar
      this.correoPreRegistro = this.form.correo;

      localStorage.setItem('correoPreRegistro', this.form.correo);

      // NO cambiar de paso aquí
      return;

    } catch (error: any) {
      Swal.fire('Error', error?.error?.error || 'No se pudo enviar el correo.', 'error');
      return;
    }
  }

  // Paso 2
  if (this.step === 2 && !this.validarPasswordFuerte()) return;
  this.step = 3;
}


  prevStep() {
  if (this.step === 2 && this.route.snapshot.queryParams['skip'] === '1') {
    return; // evitar regresar al paso 1 después de verificación
  }
  this.step = (this.step - 1) as 1 | 2 | 3;
}


  irALogin() {
    this.router.navigate(['/login']);
  }

  /** 🎨 Toggle para seleccionar/deseleccionar biometría */
  toggleBiometric(tipo: 'HUELLA' | null) {
    if (tipo === 'HUELLA') {
      this.enrollBiometria = true;
      this.tipoBiometria = 'HUELLA';
    } else {
      this.enrollBiometria = false;
      this.tipoBiometria = null;
    }
  }

  validarCorreoLocal() {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailValid = regex.test(this.form.correo);
    if (this.emailValid) this.verificarCorreoBD();
  }

  validarTelefonoLocal() {
    const regex = /^[0-9]{10}$/;
    this.phoneValid = regex.test(this.form.telefono);
    if (this.phoneValid) this.verificarTelefonoBD();
  }

  verificarCorreoBD() {
    console.log('Verificando correo:', this.form.correo);
    this.auth.verificarCorreo(this.form.correo).pipe(
      catchError((error) => {
        console.error('Error verificando correo:', error);
        this.emailExists = false;
        return [];
      })
    ).subscribe((res: any) => {
      console.log('Resultado de verificación de correo:', res);
      this.emailExists = !!res?.exists;
    });
  }

  verificarTelefonoBD() {
    console.log('Verificando teléfono:', this.form.telefono);
    this.auth.verificarTelefono(this.form.telefono).pipe(
      catchError((error) => {
        console.error('Error verificando teléfono:', error);
        this.phoneExists = false;
        return [];
      })
    ).subscribe((res: any) => {
      console.log('Resultado de verificación de teléfono:', res);
      this.phoneExists = !!res?.exists;
    });
  }

  validarDatosPersonales(): boolean {
    if (!this.form.nombre || !this.form.apaterno || !this.form.amaterno || !this.form.correo || !this.form.telefono) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor llena todos los campos.',
        confirmButtonColor: '#F59E0B',
      });
      return false;
    }
    if (!this.emailValid || this.emailExists) {
      Swal.fire({
        icon: 'error',
        title: 'Correo inválido o existente',
        text: 'Introduce un correo válido o diferente.',
        confirmButtonColor: '#E53E3E',
      });
      return false;
    }
    if (!this.phoneValid || this.phoneExists) {
      Swal.fire({
        icon: 'error',
        title: 'Teléfono inválido o existente',
        text: 'Introduce un número válido o diferente.',
        confirmButtonColor: '#E53E3E',
      });
      return false;
    }
    return true;
  }

  onPasswordInput() {
    const pass = this.form.contrasena;
    this.showPasswordTip = true;
    if (!pass) {
      this.passwordStage = 0;
      return;
    }

    const hasLower = this.hasLowercase();
    const hasUpper = this.hasUppercase();
    const hasNumber = this.hasNumber();
    const hasSymbol = this.hasSpecialChar();
    const minLength = pass.length >= 8;

    const score = [hasLower, hasUpper, hasNumber, hasSymbol, minLength].filter(Boolean).length;
    this.passwordStage = score <= 2 ? 1 : score === 3 || score === 4 ? 2 : 3;
  }

  validarPasswordFuerte(): boolean {
    return this.passwordStage === 3 && this.form.contrasena === this.form.confirmPassword;
  }

  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

async registrar() {
  this.cargando = true;

  try {

    // ============================================================
    // 🚫 1) Si NO USA BIOMETRÍA → Crear usuario normal
    // ============================================================
    if (!this.enrollBiometria) {
      await this.crearUsuarioNormal();
      return;
    }

    // ============================================================
    // 🟦 2) Validar soporte biométrico antes de crear usuario
    // ============================================================
    if (!window.PublicKeyCredential) {
      Swal.fire('Error', 'Tu navegador no admite huella digital.', 'error');
      return;
    }

    const compatible = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!compatible) {
      Swal.fire('Error', 'Tu dispositivo no soporta huella.', 'error');
      return;
    }

    // ============================================================
    // 🟨 3) Solicitar opciones WebAuthn del backend
    // ============================================================
    const options = await this.bio.registerOptions({
      correo: this.form.correo,
      tipo: 'HUELLA'
    }).toPromise();

    const challengeAB = this.base64ToArrayBuffer(options.challenge);
    const userIdAB = this.base64ToArrayBuffer(options.user.id);

    Swal.fire({
      title: 'Registra tu huella',
      text: 'Coloca tu dedo en el lector',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // ============================================================
    // 🟩 4) Intentar crear credencial biométrica
    // ============================================================
    let cred: any;
    try {
      cred = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: challengeAB,
          user: { ...options.user, id: userIdAB }
        }
      });
    } catch (e) {
      Swal.close();
      Swal.fire('Cancelado', 'No completaste la huella. No se creó la cuenta.', 'info');
      return; // ⛔ NO crear usuario
    }

    Swal.close();

    if (!cred) {
      Swal.fire('Error', 'No se pudo registrar la huella.', 'error');
      return;
    }

    // ============================================================
    // 🟧 5) Preparar datos biométricos
    // ============================================================
    const biometricPayload = {
      credentialId: cred.id,
      rawId: this.arrayBufferToBase64(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: this.arrayBufferToBase64(cred.response.clientDataJSON),
        attestationObject: this.arrayBufferToBase64(cred.response.attestationObject)
      }
    };

    // ============================================================
    // 🟩 6) Crear usuario REAL + guardar biometría EN UN SOLO PASO
    // ============================================================
    await this.bio.registerWithBiometric({
      ...this.form,
      biometria: {
        tipo: 'HUELLA',
        challenge: options.challenge,
        credentialData: biometricPayload
      }
    }).toPromise();

    Swal.fire('Éxito', 'Registro completado con huella digital.', 'success');

    localStorage.removeItem('correoPreRegistro');
    this.router.navigate(['/login']);

  } catch (err: any) {
    console.error(err);
    Swal.fire('Error', err?.error?.error || 'No se pudo completar el registro.', 'error');
  } finally {
    this.cargando = false;
  }
}

private async crearUsuarioNormal() {
  try {
    const payload = {
      correo: this.form.correo,
      contrasena: this.form.contrasena,
      palabra_secreta: this.form.palabra_secreta
    };

    await this.auth.finalizarRegistro(payload).toPromise();

    Swal.fire('Cuenta creada', 'Ya puedes iniciar sesión.', 'success');
    this.router.navigate(['/login']);
  } catch (err: any) {
    Swal.fire('Error', err?.error?.error || 'No se pudo crear la cuenta.', 'error');
  }
}


private async crearUsuario() {
  try {
    const payload = {
      correo: this.form.correo,
      contrasena: this.form.contrasena,
      palabra_secreta: this.form.palabra_secreta
    };

    await this.auth.finalizarRegistro(payload).toPromise();

    Swal.fire({
      icon: 'success',
      title: 'Cuenta creada correctamente',
      text: 'Ya puedes iniciar sesión.'
    });

    this.router.navigate(['/login']);

  } catch (err: any) {
    Swal.fire({
      icon: 'error',
      title: 'Error al crear cuenta',
      text: err?.error?.error || 'No se pudo completar el registro.'
    });
  }
}


  private finalizarRegistro() {
    Swal.fire({
      icon: 'success',
      title: 'Registro completo',
      text: 'Tu cuenta fue creada con biometría.',
      confirmButtonColor: '#16A34A',
      
    }).then(() => this.router.navigate(['/login']));
     localStorage.removeItem('correoPreRegistro');
  }

  loginOAuth(provider: 'google' | 'facebook') {
    this.oauthLoading = provider;
    this.oauth.login(provider);
  }

  addBounceEffect(event: Event) {
    const button = event.currentTarget as HTMLElement;
    if (!button) return;
    
    button.classList.remove('released');
    void button.offsetWidth;
    button.classList.add('released');
    
    setTimeout(() => {
      button.classList.remove('released');
    }, 350);
  }
}