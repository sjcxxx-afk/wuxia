import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import WoodTabBar from "../../components/WoodTabBar";
import { colors } from "../../lib/theme";

/**
 * 底部导航 —— 木架
 *
 * 交互上的四处改动，都是为了解决「点击反馈 / 切换动画 / 响应速度」：
 *
 * 1. 自定义 tabBar（components/WoodTabBar.tsx）
 *    换掉默认实现：默认只有颜色变化，既没有按下态，也没有图标动画。
 *
 * 2. 页面切换启用 shift 转场（由 react-native-screens 提供）
 *    原来四个 Tab 之间是**硬切**，视觉上像闪了一下。
 *
 * 3. freezeOnBlur
 *    切走的页面冻结渲染，滚动与动画不再抢帧 —— 这是「响应速度」的主要来源。
 *
 * 4. lazy + detachInactiveScreens
 *    首次进入才加载，切走后从渲染树摘掉，降低常驻内存。
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      // 这是 navigator 级选项，不在 screenOptions 里
      detachInactiveScreens
      tabBar={(props) => <WoodTabBar {...props} bottomInset={insets.bottom} />}
      screenOptions={{
        headerShown: false,
        // 选中/未选中色由 WoodTabBar 自己控制；这里给默认值以防万一被直接渲染
        tabBarActiveTintColor: colors.accentOnWood,
        tabBarInactiveTintColor: colors.iconOnWood,
        // 键盘弹出时收起导航栏 —— 输入页需要空间
        tabBarHideOnKeyboard: true,
        // 转场：位移 + 淡入，配合下面的 freezeOnBlur
        animation: "shift",
        freezeOnBlur: true,
        lazy: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="items" options={{ title: "匣中" }} />
      <Tabs.Screen name="categories" options={{ title: "分类" }} />
      <Tabs.Screen name="search" options={{ title: "搜索" }} />
      <Tabs.Screen name="profile" options={{ title: "匣主" }} />
    </Tabs>
  );
}