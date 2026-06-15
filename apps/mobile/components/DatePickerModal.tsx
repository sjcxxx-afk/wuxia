import { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COL_DATE_WIDTH = (SCREEN_WIDTH - 48) / 5;
const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;

type Props = {
  visible: boolean;
  value: string; // YYYY-MM-DD 或 YYYY-MM-DD HH:mm
  onConfirm: (datetime: string) => void;
  onCancel: () => void;
  maxDate?: Date;
};

/** 格式化日期时间 YYYY-MM-DD HH:mm */
const fmt = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
};

/** 解析 YYYY-MM-DD 或 YYYY-MM-DD HH:mm */
const parse = (text: string): Date => {
  const now = new Date();
  if (!text) return now;
  const [datePart, timePart] = text.split(" ");
  const dateParts = datePart.split("-");
  if (dateParts.length === 3) {
    const [y, m, d] = dateParts.map(Number);
    let h = now.getHours();
    let min = now.getMinutes();
    if (timePart) {
      const timeParts = timePart.split(":");
      if (timeParts.length === 2) {
        h = Number(timeParts[0]);
        min = Number(timeParts[1]);
      }
    }
    const date = new Date(y, m - 1, d, h, min);
    if (!isNaN(date.getTime())) return date;
  }
  return now;
};

export default function DatePickerModal({
  visible,
  value,
  onConfirm,
  onCancel,
  maxDate,
}: Props) {
  const today = maxDate ?? new Date();
  const currentYear = today.getFullYear();
  const startYear = currentYear - 20;

  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) =>
    String(startYear + i)
  );
  const months = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );
  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  // 每5分钟一档
  const minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0")
  );

  const initialDate = parse(value);
  const [selYear, setSelYear] = useState(String(initialDate.getFullYear()));
  const [selMonth, setSelMonth] = useState(
    String(initialDate.getMonth() + 1).padStart(2, "0")
  );
  const [selDay, setSelDay] = useState(
    String(initialDate.getDate()).padStart(2, "0")
  );
  const [selHour, setSelHour] = useState(
    String(initialDate.getHours()).padStart(2, "0")
  );
  // 就近取整到5分钟
  const nearestMin = Math.round(initialDate.getMinutes() / 5) * 5;
  const minStr = String(nearestMin >= 60 ? 0 : nearestMin).padStart(2, "0");
  const [selMinute, setSelMinute] = useState(minStr);

  const yearScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // 某年某月有多少天
  const daysInMonth = useCallback(
    (y: string, m: string) =>
      new Date(Number(y), Number(m), 0).getDate(),
    []
  );

  const days = Array.from(
    { length: daysInMonth(selYear, selMonth) },
    (_, i) => String(i + 1).padStart(2, "0")
  );

  // 打开时同步初始值并滚动
  useEffect(() => {
    if (visible) {
      const d = parse(value);
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const nearestM = Math.round(d.getMinutes() / 5) * 5;
      const minVal = String(nearestM >= 60 ? 0 : nearestM).padStart(2, "0");
      const maxDay = new Date(Number(y), Number(m), 0).getDate();
      const dayIndex = Number(day) - 1;
      setSelYear(y);
      setSelMonth(m);
      setSelDay(day);
      setSelHour(h);
      setSelMinute(minVal);
      setTimeout(() => {
        scrollTo(yearScrollRef, years.indexOf(y));
        scrollTo(monthScrollRef, months.indexOf(m));
        if (dayIndex >= 0 && dayIndex < maxDay) {
          scrollTo(dayScrollRef, dayIndex);
        }
        scrollTo(hourScrollRef, hours.indexOf(h));
        scrollTo(minuteScrollRef, minutes.indexOf(minVal));
      }, 150);
    }
  }, [visible]);

  // 选择年月后可能超出当月天数
  useEffect(() => {
    const maxDay = daysInMonth(selYear, selMonth);
    const currentDay = Number(selDay);
    if (currentDay > maxDay) {
      setSelDay(String(maxDay).padStart(2, "0"));
    }
  }, [selYear, selMonth]);

  const scrollTo = (ref: React.RefObject<ScrollView | null>, index: number) => {
    if (index < 0) return;
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
  };

  const handleConfirm = () => {
    onConfirm(`${selYear}-${selMonth}-${selDay} ${selHour}:${selMinute}`);
  };

  const handleNow = () => {
    const t = fmt(today);
    onConfirm(t);
  };

  const renderColumn = (
    items: string[],
    selected: string,
    onSelect: (v: string) => void,
    ref: React.RefObject<ScrollView | null>
  ) => {
    return (
      <View style={styles.column}>
        {/* 高亮条 */}
        <View style={styles.highlightBar} pointerEvents="none" />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2),
          }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.y / ITEM_HEIGHT
            );
            if (index >= 0 && index < items.length) {
              onSelect(items[index]);
            }
          }}
          onScrollEndDrag={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.y / ITEM_HEIGHT
            );
            if (index >= 0 && index < items.length) {
              onSelect(items[index]);
            }
          }}
        >
          {items.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.item}
              onPress={() => {
                onSelect(item);
                scrollTo(ref, items.indexOf(item));
              }}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.itemText,
                  item === selected && styles.itemTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.title}>选择时间</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmText}>确定</Text>
            </TouchableOpacity>
          </View>

          {/* Column labels */}
          <View style={styles.labelRow}>
            <Text style={styles.labelText}>年</Text>
            <Text style={styles.labelText}>月</Text>
            <Text style={styles.labelText}>日</Text>
            <Text style={styles.labelText}>时</Text>
            <Text style={styles.labelText}>分</Text>
          </View>

          {/* Pickers */}
          <View style={styles.pickerRow}>
            {renderColumn(years, selYear, setSelYear, yearScrollRef)}
            {renderColumn(months, selMonth, setSelMonth, monthScrollRef)}
            {renderColumn(days, selDay, setSelDay, dayScrollRef)}
            {renderColumn(hours, selHour, setSelHour, hourScrollRef)}
            {renderColumn(minutes, selMinute, setSelMinute, minuteScrollRef)}
          </View>

          {/* Quick select */}
          <TouchableOpacity style={styles.todayBtn} onPress={handleNow}>
            <Text style={styles.todayBtnText}>🕐 现在</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cancelText: { fontSize: 15, color: "#6B7280" },
  title: { fontSize: 16, fontWeight: "600", color: "#111827" },
  confirmText: { fontSize: 15, fontWeight: "600", color: "#4F46E5" },
  labelRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 6,
  },
  labelText: {
    width: COL_DATE_WIDTH,
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  pickerRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    overflow: "hidden",
  },
  column: {
    width: COL_DATE_WIDTH,
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    position: "relative",
  },
  highlightBar: {
    position: "absolute",
    top: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2),
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    zIndex: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 17,
    color: "#9CA3AF",
  },
  itemTextSelected: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 18,
  },
  todayBtn: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
  },
  todayBtnText: { fontSize: 14, color: "#374151", fontWeight: "500" },
});
