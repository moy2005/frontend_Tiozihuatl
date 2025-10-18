import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth';
import { BiometricService } from '../../services/biometric';
import { OauthService } from '../../services/oauth';
import { catchError } from 'rxjs/operators';

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

  form = {
    nombre: '',
    apaterno: '',
    amaterno: '',
    correo: '',
    telefono: '',
    contrasena: '',
    confirmPassword: '',
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
    private router: Router
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

  nextStep() {
    if (this.step === 1 && !this.validarDatosPersonales()) return;
    if (this.step === 2 && !this.validarPasswordFuerte()) return;
    this.step = (this.step < 3 ? this.step + 1 : 3) as 1 | 2 | 3;
  }

  prevStep() {
    if (this.step > 1) {
      this.step = (this.step - 1) as 1 | 2 | 3;
    }
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
      // Si no quiere biometría, crear usuario normal
      if (!this.enrollBiometria) {
        await this.crearUsuario();
        return;
      }

      // Verificar soporte de WebAuthn
      if (!window.PublicKeyCredential) {
        Swal.fire({
          icon: 'info',
          title: 'No soportado',
          text: 'Tu navegador no admite autenticación biométrica.',
          confirmButtonColor: '#3B82F6',
        });
        this.cargando = false;
        return;
      }

      // Verificar compatibilidad del dispositivo
      const compatible = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!compatible) {
        Swal.fire({
          icon: 'info',
          title: 'Huella no disponible',
          text: 'Tu equipo no cuenta con lector de huella digital compatible.',
          confirmButtonColor: '#3B82F6',
        });
        this.cargando = false;
        return;
      }

      console.log('📋 Solicitando opciones de registro biométrico...');
      const options = await this.bio.registerOptions({ 
        correo: this.form.correo, 
        tipo: 'HUELLA' 
      }).toPromise();

      if (!options) {
        Swal.fire({
          icon: 'error',
          title: 'Error de servidor',
          text: 'No se recibieron opciones de registro biométrico.',
          confirmButtonColor: '#E53E3E',
        });
        this.cargando = false;
        return;
      }

      console.log('📋 Opciones de registro biométrico recibidas');

      const challengeArrayBuffer = this.base64ToArrayBuffer(options.challenge);
      const userIdArrayBuffer = this.base64ToArrayBuffer(options.user.id);

      console.log('🔑 Challenge convertido a ArrayBuffer, longitud:', challengeArrayBuffer.byteLength);
      console.log('👤 UserID convertido a ArrayBuffer, longitud:', userIdArrayBuffer.byteLength);

      let cred: any = null;
      try {
        console.log('🔐 Solicitando credencial biométrica (huella)...');
        
        // Mostrar mensaje al usuario
        Swal.fire({
          title: 'Registra tu huella',
          text: 'Por favor, coloca tu dedo en el sensor de huella digital',
          icon: 'info',
          showConfirmButton: false,
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        cred = await navigator.credentials.create({
          publicKey: {
            ...options,
            challenge: challengeArrayBuffer,
            user: { ...options.user, id: userIdArrayBuffer },
          },
        });

        Swal.close();
        console.log('✅ Credencial biométrica creada exitosamente');
      } catch (err: any) {
        Swal.close();
        console.error('❌ Error al crear la credencial biométrica:', err);
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Cancelaste el registro biométrico o no se detectó el lector.'
            : 'Error inesperado durante la autenticación biométrica.';
        Swal.fire({
          icon: 'error',
          title: 'Registro biométrico cancelado',
          text: msg + ' No se creó ninguna cuenta.',
          confirmButtonColor: '#E53E3E',
        });
        this.cargando = false;
        return;
      }

      if (!cred) {
        Swal.fire({
          icon: 'warning',
          title: 'Sin datos biométricos',
          text: 'No se pudo obtener la información de autenticación. No se creó ninguna cuenta.',
          confirmButtonColor: '#E53E3E',
        });
        this.cargando = false;
        return;
      }

      console.log('📦 Datos de la credencial biométrica:', {
        id: cred.id,
        type: cred.type,
        rawIdLength: cred.rawId.byteLength,
        responseKeys: Object.keys(cred.response),
      });

      const biometricData = {
        credentialId: cred.id,
        rawId: this.arrayBufferToBase64(cred.rawId),
        type: cred.type,
        clientDataJSON: this.arrayBufferToBase64(
          typeof cred.response.clientDataJSON === 'string'
            ? this.stringToArrayBuffer(cred.response.clientDataJSON)
            : cred.response.clientDataJSON
        ),
        attestationObject: this.arrayBufferToBase64(cred.response.attestationObject),
      };

      console.log('📦 Datos biométricos preparados');
      console.log('📝 Creando usuario con biometría en la base de datos...');

      const registroPayload = {
        ...this.form,
        biometria: {
          tipo: 'HUELLA',
          challenge: options.challenge,
          credentialData: {
            id: biometricData.credentialId,
            rawId: biometricData.rawId,
            type: biometricData.type,
            response: {
              clientDataJSON: biometricData.clientDataJSON,
              attestationObject: biometricData.attestationObject,
            },
          },
        },
      };

      console.log('📤 Enviando registro completo al backend...');

      try {
        await this.bio.registerWithBiometric(registroPayload).toPromise();
        console.log('✅ Usuario y biometría registrados exitosamente');

        Swal.fire({
          icon: 'success',
          title: 'Huella registrada',
          text: 'Tu cuenta ha sido creada con huella digital exitosamente.',
          confirmButtonColor: '#16A34A',
        });

        this.finalizarRegistro();
      } catch (err: any) {
        console.error('❌ Error al registrar usuario con biometría:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error en el registro',
          text: err?.error?.error || 'No se pudo completar el registro. Intenta nuevamente.',
          confirmButtonColor: '#E53E3E',
        });
      }
    } catch (err) {
      console.error('❌ Error en el proceso de registro:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error en biometría',
        text: 'No se completó el registro. Intenta nuevamente.',
        confirmButtonColor: '#E53E3E',
      });
    } finally {
      this.cargando = false;
    }
  }

  private async crearUsuario() {
    await this.auth.register(this.form).toPromise();
    Swal.fire({
      icon: 'success',
      title: 'Registro exitoso',
      text: 'Tu cuenta ha sido creada correctamente.',
      confirmButtonColor: '#16A34A',
    });
    this.router.navigate(['/login']);
  }

  private finalizarRegistro() {
    Swal.fire({
      icon: 'success',
      title: 'Registro completo',
      text: 'Tu cuenta fue creada con biometría.',
      confirmButtonColor: '#16A34A',
    }).then(() => this.router.navigate(['/login']));
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