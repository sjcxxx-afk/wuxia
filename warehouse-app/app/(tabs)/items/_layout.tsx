import { Stack } from "expo-router";

export default function ItemsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" />
      <Stack.Screen name="edit/[id]" />
      <Stack.Screen name="ocr-import" />
      <Stack.Screen name="file-import" />
    </Stack>
  );
}
