import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimiter';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const REMEMBER_KEY = 'thot_remember_email';

const RegisterSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(20, 'El nombre de usuario no puede superar 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos'),
  email: z.string().email('Correo electrónico inválido').max(255),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres').max(255),
});

const LoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido').max(255),
  password: z.string().min(1, 'Introduce tu contraseña').max(255),
});

/** Sanitiza mensajes de error antes de mostrarlos al usuario */
function sanitize(msg: string) {
  return msg.replace(/[<>]/g, '').slice(0, 200).trim();
}

const GENRES = [
  'Terror', 'Fantasía', 'Romance', 'Ciencia ficción',
  'Misterio', 'Aventura', 'Drama', 'Histórica',
  'Poesía', 'Thriller', 'Comedia', 'Distopía',
];


// ─── Forgot Password Flow ─────────────────────────────────────────────────────

function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'request' | 'sent'>('request');
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendResetEmail() {
    const emailVal = contact.trim().toLowerCase();
    const result = z.string().email().safeParse(emailVal);
    if (!result.success) {
      setContactError('Introduce un correo electrónico válido.');
      return;
    }
    setLoading(true);
    // No diferenciamos si el email existe o no — mensaje genérico siempre
    await supabase.auth.resetPasswordForEmail(emailVal).catch(() => {});
    setLoading(false);
    setContactError('');
    setStep('sent');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.centerBlock}>

          <View style={styles.forgotHeader}>
            <TouchableOpacity hitSlop={8} onPress={onBack}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.forgotContent}>
            <Text style={styles.forgotTitle}>
              {step === 'request' ? 'Recuperar contraseña' : 'Revisa tu correo'}
            </Text>
            <Text style={styles.forgotSubtitle}>
              {step === 'request'
                ? 'Introduce tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.'
                : 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.'}
            </Text>

            {step === 'request' && (
              <>
                <TextInput
                  style={[styles.input, !!contactError && styles.inputError]}
                  placeholder="Correo electrónico"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  value={contact}
                  onChangeText={(v) => { setContact(v); setContactError(''); }}
                />
                {!!contactError && <Text style={styles.fieldError}>{sanitize(contactError)}</Text>}
                <TouchableOpacity
                  style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
                  onPress={sendResetEmail}
                  disabled={loading}
                  activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>
                    {loading ? 'Enviando…' : 'Enviar enlace'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'sent' && (
              <TouchableOpacity style={styles.btnPrimary} onPress={onBack} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Volver al inicio</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isForgot, setIsForgot] = useState(false);
  const [genreStep, setGenreStep] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Cargar email guardado si "recordar" estaba activo
  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_KEY).then((saved) => {
      if (saved) { setEmail(saved); setRememberMe(true); }
    });
  }, []);

  if (isForgot) {
    return <ForgotPasswordFlow onBack={() => setIsForgot(false)} />;
  }

  if (genreStep) {
    function toggleGenre(g: string) {
      setSelectedGenres((prev) => {
        if (prev.includes(g)) return prev.filter((x) => x !== g);
        if (prev.length >= 3) return prev;
        return [...prev, g];
      });
    }
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centerBlock}>
          <View style={styles.wordmarkArea}>
            <Text style={styles.wordmark}>thot</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.genreTitle}>Elige tus géneros favoritos</Text>
            <Text style={styles.genreSubtitle}>
              Selecciona hasta 3 géneros para personalizar tus recomendaciones
            </Text>
            <View style={styles.genreGrid}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genreChip, selectedGenres.includes(g) && styles.genreChipActive]}
                  onPress={() => toggleGenre(g)}>
                  <Text style={[styles.genreChipText, selectedGenres.includes(g) && styles.genreChipTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.buttonsArea}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={async () => {
              if (selectedGenres.length > 0) {
                await AsyncStorage.setItem('thot_user_genres', JSON.stringify(selectedGenres));
              }
              await AsyncStorage.removeItem('thot_onboarding_pending');
              router.replace('/(tabs)');
            }}
            activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>
              {selectedGenres.length === 0 ? 'Saltar' : `Empezar (${selectedGenres.length}/3)`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function handlePrimary() {
    setAuthError('');
    setLoading(true);
    try {
      const emailTrimmed = email.trim().toLowerCase();
      const passwordTrimmed = password;

      if (mode === 'register') {
        if (!nombre.trim()) { setLoading(false); setAuthError('Introduce tu nombre.'); return; }
        if (!username.trim()) { setLoading(false); setAuthError('Introduce un nombre de usuario.'); return; }
        if (!emailTrimmed) { setLoading(false); setAuthError('Introduce tu correo.'); return; }
        if (passwordTrimmed.length < 12) { setLoading(false); setAuthError('La contraseña debe tener al menos 12 caracteres.'); return; }
        if (passwordTrimmed !== passwordRepeat) { setLoading(false); setAuthError('Las contraseñas no coinciden.'); return; }

        const result = await supabase.auth.signUp({
          email: emailTrimmed,
          password: passwordTrimmed,
          options: { data: { nombre: nombre.trim() } },
        });

        if (result.error) {
          setLoading(false);
          setAuthError('No se pudo crear la cuenta. Verifica los datos e inténtalo de nuevo.');
          return;
        }

        if (result.data?.user) {
          await supabase.from('profiles')
            .update({ username: username.trim() })
            .eq('id', result.data.user.id);
        }

        await AsyncStorage.setItem('thot_onboarding_pending', '1');
        setLoading(false);
        setGenreStep(true);

      } else {
        if (!emailTrimmed) { setLoading(false); setAuthError('Introduce tu correo.'); return; }
        if (!passwordTrimmed) { setLoading(false); setAuthError('Introduce tu contraseña.'); return; }

        const result = await supabase.auth.signInWithPassword({
          email: emailTrimmed,
          password: passwordTrimmed,
        });

        setLoading(false);

        if (result.error) {
          setAuthError(`Supabase: ${result.error.message}`);
          return;
        }

        if (rememberMe) {
          await AsyncStorage.setItem(REMEMBER_KEY, emailTrimmed);
        } else {
          await AsyncStorage.removeItem(REMEMBER_KEY);
        }

        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setLoading(false);
      setAuthError(`Debug: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerBlock}>

              <View style={styles.wordmarkArea}>
                <Text style={styles.wordmark}>thot</Text>
              </View>

              <View style={styles.form}>
                {mode === 'register' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Nombre completo"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="words"
                      value={nombre}
                      onChangeText={(v) => { setNombre(v); setAuthError(''); }}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Nombre de usuario"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={username}
                      onChangeText={(v) => { setUsername(v.replace(/\s/g, '')); setAuthError(''); }}
                    />
                  </>
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Correo electrónico"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setAuthError(''); }}
                />
                {!!authError && <Text style={styles.fieldError}>{sanitize(authError)}</Text>}
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Contraseña"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    hitSlop={8}
                    onPress={() => setShowPassword((v) => !v)}>
                    <MaterialIcons
                      name={showPassword ? 'visibility' : 'visibility-off'}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {mode === 'register' && (
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Repetir contraseña"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPasswordRepeat}
                      autoCapitalize="none"
                      value={passwordRepeat}
                      onChangeText={setPasswordRepeat}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      hitSlop={8}
                      onPress={() => setShowPasswordRepeat((v) => !v)}>
                      <MaterialIcons
                        name={showPasswordRepeat ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={Colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {mode === 'login' && (
                  <>
                    <TouchableOpacity
                      style={styles.checkRow}
                      onPress={() => setRememberMe((v) => !v)}
                      activeOpacity={0.7}>
                      <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                        {rememberMe && (
                          <MaterialIcons name="check" size={14} color={Colors.background} />
                        )}
                      </View>
                      <Text style={styles.checkLabel}>Recordar contraseña</Text>
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => setIsForgot(true)}>
                      <Text style={styles.forgotLink}>¿Has olvidado la contraseña?</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Buttons — fuera del KAV, siempre fijos al fondo */}
      <View style={styles.buttonsArea}>
        <TouchableOpacity
          style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
          onPress={handlePrimary}
          disabled={loading}
          activeOpacity={0.85}>
          <Text style={styles.btnPrimaryText}>
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.btnSecondary}
          activeOpacity={0.85}
          onPress={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setNombre('');
            setUsername('');
            setPassword('');
            setPasswordRepeat('');
            setShowPassword(false);
            setShowPasswordRepeat(false);
            setAuthError('');
          }}>
          <Text style={styles.btnSecondaryText}>
            {mode === 'login' ? 'Registrarse' : 'Ya tengo cuenta'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  wordmarkArea: {
    alignItems: 'center',
    paddingBottom: 56,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 52,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -1,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 24,
    gap: 12,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    color: Colors.text,
    fontSize: 15,
  },
  inputError: {
    borderColor: '#c0392b',
  },
  fieldError: {
    color: '#c0392b',
    fontSize: 12,
    marginTop: -4,
    paddingHorizontal: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
  },
  passwordInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  checkLabel: {
    color: Colors.text,
    fontSize: 14,
  },
  forgotLink: {
    color: Colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  forgotHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  forgotContent: {
    paddingHorizontal: 24,
    gap: 16,
  },
  forgotTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  forgotSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  buttonsArea: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 32,
  },
  btnPrimary: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#1f566b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  btnSecondary: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  genreTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  genreSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  genreChipActive: {
    backgroundColor: '#1f566b',
    borderColor: '#1f566b',
  },
  genreChipText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  genreChipTextActive: {
    color: '#ffffff',
  },
});
