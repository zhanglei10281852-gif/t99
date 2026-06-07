<template>
  <div class="profile-page">
    <div class="page-header">
      <a-button @click="goBack">
        <ArrowLeftOutlined />
        返回
      </a-button>
      <h2>老人就餐画像</h2>
    </div>

    <a-spin :spinning="loading">
      <a-row :gutter="24" v-if="profile">
        <a-col :span="8">
          <a-card title="基本信息" class="info-card">
            <div class="avatar-section">
              <a-avatar :size="80" style="background-color: #1890ff; fontSize: 32px">
                {{ profile.elderly.name?.charAt(0) }}
              </a-avatar>
              <div class="name-section">
                <div class="name">{{ profile.elderly.name }}</div>
                <div class="tags">
                  <a-tag v-if="profile.elderly.isAlone" color="orange">独居</a-tag>
                  <a-tag v-if="profile.elderly.age >= 80" color="red">高龄</a-tag>
                  <a-tag color="blue">{{ getPatternText(profile.pattern.patternType) }}</a-tag>
                </div>
              </div>
            </div>
            <a-descriptions :column="1" size="small" class="desc">
              <a-descriptions-item label="年龄">{{ profile.elderly.age }}岁</a-descriptions-item>
              <a-descriptions-item label="性别">
                {{ profile.elderly.gender === 'male' ? '男' : '女' }}
              </a-descriptions-item>
              <a-descriptions-item label="电话">{{ profile.elderly.phone }}</a-descriptions-item>
              <a-descriptions-item label="社区">{{ profile.elderly.community }}</a-descriptions-item>
              <a-descriptions-item label="地址">{{ profile.elderly.address }}</a-descriptions-item>
              <a-descriptions-item label="所属助餐点">
                {{ profile.elderly.canteenId?.name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="紧急联系人" v-if="profile.elderly.emergencyContact">
                {{ profile.elderly.emergencyContact.name }}
                ({{ profile.elderly.emergencyContact.relation }})
                <br />
                {{ profile.elderly.emergencyContact.phone }}
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="就餐统计" style="margin-top: 16px">
            <a-row :gutter="16">
              <a-col :span="12">
                <div class="stat-box">
                  <div class="stat-value">{{ profile.stats.totalCheckIns }}</div>
                  <div class="stat-label">总就餐次数</div>
                </div>
              </a-col>
              <a-col :span="12">
                <div class="stat-box">
                  <div class="stat-value">{{ profile.stats.monthCheckIns }}</div>
                  <div class="stat-label">本月就餐</div>
                </div>
              </a-col>
              <a-col :span="12">
                <div class="stat-box">
                  <div class="stat-value">{{ profile.stats.monthlyAttendanceRate }}%</div>
                  <div class="stat-label">本月出勤率</div>
                </div>
              </a-col>
              <a-col :span="12">
                <div class="stat-box">
                  <div class="stat-value">{{ profile.stats.consecutiveDays }}</div>
                  <div class="stat-label">连续就餐天数</div>
                </div>
              </a-col>
            </a-row>
            <a-divider />
            <div class="info-row">
              <span class="label">最近就餐:</span>
              <span class="value">
                {{ profile.stats.lastCheckInDate ? formatDate(profile.stats.lastCheckInDate) : '暂无记录' }}
              </span>
            </div>
            <div class="info-row">
              <span class="label">未就餐天数:</span>
              <span class="value" :class="{ warning: profile.stats.missingDays > 2 }">
                {{ profile.stats.missingDays }} 天
              </span>
            </div>
          </a-card>

          <a-card title="活跃预警" style="margin-top: 16px" v-if="profile.activeAlerts.length > 0">
            <a-list size="small" :data-source="profile.activeAlerts">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-tag :color="getLevelColor(item.level)" style="font-weight: bold">
                    {{ getLevelText(item.level) }}
                  </a-tag>
                  <span style="margin-left: 8px">
                    连续{{ item.reason?.consecutiveDays }}天未就餐
                  </span>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>

        <a-col :span="16">
          <a-card title="就餐日历热力图">
            <div class="calendar-header">
              <a-button-group>
                <a-button @click="prevMonth">
                  <LeftOutlined />
                </a-button>
                <span class="month-label">{{ currentYear }}年{{ currentMonth }}月</span>
                <a-button @click="nextMonth">
                  <RightOutlined />
                </a-button>
              </a-button-group>
              <div class="legend">
                <span class="legend-item">
                  <span class="legend-color none"></span> 未就餐
                </span>
                <span class="legend-item">
                  <span class="legend-color low"></span> 1餐
                </span>
                <span class="legend-item">
                  <span class="legend-color high"></span> 2餐
                </span>
              </div>
            </div>
            <div class="calendar-weekdays">
              <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
            </div>
            <div class="calendar-grid">
              <div
                v-for="(day, index) in calendarDays"
                :key="index"
                class="calendar-day"
                :class="{
                  empty: !day.date,
                  'has-lunch': day.lunch,
                  'has-dinner': day.dinner,
                  'both-meals': day.lunch && day.dinner,
                  'one-meal': day.count === 1,
                }"
              >
                <span class="day-number" v-if="day.date">
                  {{ new Date(day.date).getDate() }}
                </span>
                <div class="meal-indicators" v-if="day.date">
                  <span class="indicator lunch" :class="{ active: day.lunch }">午</span>
                  <span class="indicator dinner" :class="{ active: day.dinner }">晚</span>
                </div>
              </div>
            </div>
            <div class="calendar-stats">
              <span>本月就餐: <b>{{ calendarData?.attendedDays || 0 }}</b> 天</span>
              <span>出勤率: <b>{{ calendarData?.attendanceRate || 0 }}%</b></span>
            </div>
          </a-card>

          <a-card title="就餐规律分析" style="margin-top: 16px">
            <a-row :gutter="24">
              <a-col :span="12">
                <div class="pattern-section">
                  <h4>就餐模式</h4>
                  <a-tag color="blue" style="font-size: 16px; padding: 4px 12px">
                    {{ getPatternText(profile.pattern.patternType) }}
                  </a-tag>
                  <p class="pattern-desc">
                    近30天内共就餐 {{ profile.pattern.checkInDays }} 天，
                    出勤率 {{ (profile.pattern.attendanceRate * 100).toFixed(1) }}%
                  </p>
                </div>
              </a-col>
              <a-col :span="12">
                <div class="pattern-section">
                  <h4>偏好餐段</h4>
                  <div class="session-stats">
                    <div class="session-item">
                      <span class="session-label">午餐</span>
                      <a-progress
                        :percent="sessionPercent.lunch"
                        :show-info="false"
                        strokeColor="#1890ff"
                      />
                      <span class="session-count">{{ profile.pattern.lunchCount }}次</span>
                    </div>
                    <div class="session-item">
                      <span class="session-label">晚餐</span>
                      <a-progress
                        :percent="sessionPercent.dinner"
                        :show-info="false"
                        strokeColor="#722ed1"
                      />
                      <span class="session-count">{{ profile.pattern.dinnerCount }}次</span>
                    </div>
                  </div>
                </div>
              </a-col>
            </a-row>
          </a-card>

          <a-card title="最近就餐记录" style="margin-top: 16px">
            <a-table
              :columns="checkInColumns"
              :data-source="profile.recentCheckIns"
              :pagination="false"
              size="small"
              row-key="_id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'mealDate'">
                  {{ formatDate(record.mealDate) }}
                </template>
                <template v-else-if="column.key === 'mealSession'">
                  <a-tag :color="record.mealSession === 'lunch' ? 'blue' : 'purple'">
                    {{ record.mealSession === 'lunch' ? '午餐' : '晚餐' }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'canteen'">
                  {{ record.canteenId?.name || '-' }}
                </template>
                <template v-else-if="column.key === 'method'">
                  {{ getMethodText(record.method) }}
                </template>
              </template>
            </a-table>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import {
  getElderlyProfile,
  getElderlyCalendar,
  type ElderlyProfileResponse,
  type CalendarResponse,
} from '@/api/elderly'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const profile = ref<ElderlyProfileResponse | null>(null)
const calendarData = ref<CalendarResponse | null>(null)

const currentYear = ref(dayjs().year())
const currentMonth = ref(dayjs().month() + 1)

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const checkInColumns = [
  { title: '日期', key: 'mealDate', width: 120 },
  { title: '餐段', key: 'mealSession', width: 80 },
  { title: '助餐点', key: 'canteen', width: 150 },
  { title: '签到方式', key: 'method', width: 100 },
]

const calendarDays = computed(() => {
  if (!calendarData.value) return []

  const firstDay = dayjs(`${currentYear.value}-${currentMonth.value}-01`).day()
  const daysInMonth = calendarData.value.daysInMonth
  const calendarArr: any[] = []

  for (let i = 0; i < firstDay; i++) {
    calendarArr.push({ date: '', lunch: false, dinner: false, count: 0 })
  }

  for (const day of calendarData.value.calendar) {
    calendarArr.push(day)
  }

  return calendarArr
})

const sessionPercent = computed(() => {
  if (!profile.value) return { lunch: 0, dinner: 0 }
  const total = profile.value.pattern.lunchCount + profile.value.pattern.dinnerCount
  if (total === 0) return { lunch: 0, dinner: 0 }
  return {
    lunch: Math.round((profile.value.pattern.lunchCount / total) * 100),
    dinner: Math.round((profile.value.pattern.dinnerCount / total) * 100),
  }
})

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD')
}

function getPatternText(pattern: string) {
  const map: Record<string, string> = {
    daily: '每天来',
    weekdays: '工作日来',
    frequent: '经常来',
    occasional: '偶尔来',
    rare: '很少来',
  }
  return map[pattern] || pattern
}

function getLevelText(level: string) {
  const map: Record<string, string> = {
    red: '红色预警',
    orange: '橙色预警',
    yellow: '黄色预警',
  }
  return map[level] || level
}

function getLevelColor(level: string) {
  const map: Record<string, string> = {
    red: 'red',
    orange: 'orange',
    yellow: 'gold',
  }
  return map[level] || 'default'
}

function getMethodText(method: string) {
  const map: Record<string, string> = {
    card: '刷卡',
    face: '人脸',
    staff: '代签',
    phone: '手机',
  }
  return map[method] || method
}

function goBack() {
  router.back()
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadCalendar()
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadCalendar()
}

async function loadProfile() {
  loading.value = true
  try {
    const id = route.params.id as string
    const res = await getElderlyProfile(id)
    profile.value = res
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadCalendar() {
  try {
    const id = route.params.id as string
    const res = await getElderlyCalendar(id, currentYear.value, currentMonth.value)
    calendarData.value = res
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadProfile()
  loadCalendar()
})
</script>

<style scoped>
.profile-page {
  padding: 24px;
  background: #f5f5f5;
  min-height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.info-card {
  text-align: center;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.name-section {
  margin-top: 12px;
}

.name-section .name {
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 8px;
}

.tags {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.desc {
  text-align: left;
}

.stat-box {
  text-align: center;
  padding: 12px 0;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.info-row .label {
  color: #666;
}

.info-row .value {
  font-weight: 500;
}

.info-row .value.warning {
  color: #f5222d;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.month-label {
  display: inline-block;
  min-width: 120px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  display: inline-block;
}

.legend-color.none {
  background: #f5f5f5;
}

.legend-color.low {
  background: #91d5ff;
}

.legend-color.high {
  background: #1890ff;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: #999;
  padding: 4px 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  border-radius: 6px;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 12px;
}

.calendar-day.empty {
  background: transparent;
}

.calendar-day.one-meal {
  background: #bae7ff;
}

.calendar-day.both-meals {
  background: #1890ff;
  color: white;
}

.calendar-day .day-number {
  font-size: 14px;
  font-weight: 500;
}

.meal-indicators {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.indicator {
  width: 16px;
  height: 14px;
  font-size: 10px;
  text-align: center;
  line-height: 14px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0.5;
}

.indicator.active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.8);
  color: #1890ff;
}

.both-meals .indicator.active {
  background: white;
  color: #1890ff;
}

.calendar-stats {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-around;
  font-size: 14px;
  color: #666;
}

.calendar-stats b {
  color: #1890ff;
  font-size: 16px;
}

.pattern-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
  font-weight: normal;
}

.pattern-desc {
  margin-top: 12px;
  color: #999;
  font-size: 13px;
  line-height: 1.6;
}

.session-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-label {
  width: 40px;
  font-size: 13px;
  color: #666;
}

.session-item :deep(.ant-progress) {
  flex: 1;
}

.session-count {
  width: 50px;
  text-align: right;
  font-size: 13px;
  color: #333;
}
</style>
