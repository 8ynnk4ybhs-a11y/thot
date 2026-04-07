import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  function enter() {
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Wordmark */}
        <View style={styles.wordmarkArea}>
          <Text style={styles.wordmark}>thot</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              value={usuario}
              onChangeText={setUsuario}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Usuario"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={usuario}
            onChangeText={setUsuario}
          />
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
              <TouchableOpacity hitSlop={8}>
                <Text style={styles.forgotLink}>¿Has olvidado la contraseña?</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.buttonsArea}>
          <TouchableOpacity style={styles.btnPrimary} onPress={enter} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>
              {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
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
            onPress={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}>
            <Text style={styles.btnSecondaryText}>
              {mode === 'login' ? 'Registrarse' : 'Ya tengo cuenta'}
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  wordmarkArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: Colors.text,
    fontSize: 52,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -1,
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
  },
  buttonsArea: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 32,
    gap: 0,
  },
  btnPrimary: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: Colors.background,
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
});
