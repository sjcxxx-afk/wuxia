import { Alert } from "react-native";

export default function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void
) {
  Alert.alert(title, message, [
    { text: "取消", style: "cancel" },
    { text: "确认删除", style: "destructive", onPress: onConfirm },
  ]);
}
