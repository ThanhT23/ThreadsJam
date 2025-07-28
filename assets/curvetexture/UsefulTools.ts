import { _decorator, Component, Layers, math, Node, Quat, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UsefulTools')
export class UsefulTools {
  //是否getter方法
  static isGetter(obj: any, prop: string): boolean {
    const descriptor =
      Object.getOwnPropertyDescriptor(obj, prop) || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), prop);

    return !!descriptor?.get;
  }

  //安全地取属性值(变量/getter方法/普通方法)
  static safeGetValue(obj: any, prop: string): any {
    const descriptor =
      Object.getOwnPropertyDescriptor(obj, prop) || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), prop);

    if (descriptor?.get) {
      return obj[prop]; // 触发 getter
    } else if (typeof obj[prop] === 'function') {
      return obj[prop](); // 执行普通方法
    } else {
      return obj[prop]; // 返回普通属性
    }
  }

  /**
   * 判断一个多边形（顶点有序）的顶点数组是否存在自相交
   * @param points Vec2[] 多边形顶点（顺序排列，首尾可不闭合）
   * @returns result 是否自相交 ,index 自相交的第一个点的索引
   * 注意:Vec3的z轴会被忽略
   */
  public static isPolygonSelfIntersect(points: Vec2[] | Vec3[]): { result: boolean; index: number } {
    const n = points.length;
    if (n < 4) return { result: false, index: -1 }; // 三角形不可能自相交

    // 检查所有非相邻边是否相交（仅检查真正非相邻的边）
    for (let i = 0; i < n - 1; i++) {
      const a1 = points[i];
      const a2 = points[i + 1];
      for (let j = i + 2; j < n - 1; j++) {
        // 跳过相邻边
        if (i === 0 && j === n - 2) continue; // 首尾边不算
        const b1 = points[j];
        const b2 = points[j + 1];
        if (this.segmentsIntersect(a1, a2, b1, b2)) {
          return { result: true, index: i };
        }
      }
    }
    return { result: false, index: -1 };
  }

  /**
   * 判断两线段是否相交
   * 注意:Vec3的z轴会被忽略
   */
  public static segmentsIntersect(p1: Vec2 | Vec3, p2: Vec2 | Vec3, q1: Vec2 | Vec3, q2: Vec2 | Vec3): boolean {
    // 快速排斥
    // 快速排斥
    if (
      Math.max(p1.x, p2.x) < Math.min(q1.x, q2.x) ||
      Math.max(q1.x, q2.x) < Math.min(p1.x, p2.x) ||
      Math.max(p1.y, p2.y) < Math.min(q1.y, q2.y) ||
      Math.max(q1.y, q2.y) < Math.min(p1.y, p2.y)
    ) {
      return false;
    }

    const d1 = this.direction(q1, q2, p1);
    const d2 = this.direction(q1, q2, p2);
    const d3 = this.direction(p1, p2, q1);
    const d4 = this.direction(p1, p2, q2);

    // Proper intersection
    if (d1 * d2 < 0 && d3 * d4 < 0) {
      return true;
    }

    // Special Cases: check for colinear and endpoint overlap
    if (d1 === 0 && this.onSegment(q1, q2, p1)) return true;
    if (d2 === 0 && this.onSegment(q1, q2, p2)) return true;
    if (d3 === 0 && this.onSegment(p1, p2, q1)) return true;
    if (d4 === 0 && this.onSegment(p1, p2, q2)) return true;

    return false;
  }

  // 判断点c是否在线段ab上（假设三点共线）
  private static onSegment(a: Vec2 | Vec3, b: Vec2 | Vec3, c: Vec2 | Vec3): boolean {
    return (
      Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y)
    );
  }
  //  * 计算向量叉积
  //  * 注意:Vec3的z轴会被忽略
  //  */
  public static direction(a: Vec2 | Vec3, b: Vec2 | Vec3, c: Vec2 | Vec3): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  //从一组Vec2[]或者Vec3[]中判断所有点是否共线
  //注意: Vec3的z轴会被忽略
  //返回值: { result: boolean; index: 共线的第一个点索引值 }
  public static isCollinear(points: Vec2[] | Vec3[]): { result: boolean; index: number } {
    if (points.length < 3) return { result: false, index: -1 };

    for (let i = 0; i < points.length - 2; i++) {
      const a = points[i];
      const b = points[i + 1];
      const c = points[i + 2];
      if (this.isCollinearThreePoints(a, b, c)) {
        return { result: true, index: i };
      }
    }
    return { result: false, index: -1 };
  }

  //判断三点是否共线
  //注意: Vec3的z轴会被忽略
  public static isCollinearThreePoints(a: Vec2 | Vec3, b: Vec2 | Vec3, c: Vec2 | Vec3): boolean {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const cross = abx * acy - aby * acx;
    return Math.abs(cross) < 0.1; // 使用叉积判断共线
  }

  //判断一组Vec2[]或者Vec3[]中是否有重复点
  //注意: Vec3[]的z轴会被忽略
  public static hasDuplicatePoints(points: Vec2[] | Vec3[]): boolean {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].x === points[j].x && points[i].y === points[j].y) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 生成一个随机五位字符串
   * @returns {string}
   */
  public static randomTmpIDString(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 计算当前颜色的HSL值
  public static rgbToHsl(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0,
      l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return [h, s, l];
  }

  // 将HSL转换为RGB
  public static hslToRgb(h: number, s: number, l: number) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  /**
   * 比较两个版本号（格式如 "3.8.0"）
   * @param v1 版本号1
   * @param v2 版本号2
   * @returns
   *   - 正数：v1 > v2
   *   - 负数：v1 < v2
   *   - 0：v1 == v2
   */
  public static compareVersions(v1: string, v2: string): number {
    // 1. 分割版本号为数字数组
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    // 2. 逐级比较（从左到右）
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0; // 缺失的位补0
      const num2 = parts2[i] || 0;
      if (num1 !== num2) {
        return num1 - num2; // 优先级高的位不等时直接返回结果
      }
    }

    // 3. 所有位均相等
    return 0;
  }

  //检测某层名字是否已设置
  public static layerExist(name: string): boolean {
    const n = Layers.nameToLayer(name);
    if (n > 0) return true;
    const lname = Layers.layerToName(0);
    if (lname !== name) {
      return false;
    }
    return true;
  }

  //检查并添加新层,添加后在编辑器设置中可能未刷新.
  public static checkAndAddLayerByName(name: string): number {
    if (this.layerExist(name)) {
      console.log(`${name} 已存在 ,无需获取空闲位置`);
      return 1 << Layers.nameToLayer(name);
    }
    let n = -1;
    for (let i = 0; i < 20; i++) {
      if (Layers.layerToName(i) == undefined) {
        n = i;
        break;
      }
    }
    if (n !== -1) {
      Layers.addLayer(name, n);
      console.warn(`添加新层: ${name}，位置: ${n} ,如果在编辑器中,你需要关闭 项目设置 窗口后重新打开才能正常显示`);
      return 1 << n;
    } else {
      console.warn(`无法添加新层: ${name}，没有可用的层位置。请检查层设置。`);
      return -1;
    }
  }
}
