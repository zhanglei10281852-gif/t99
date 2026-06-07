import mongoose from 'mongoose'

export type CheckInMethod = 'card' | 'face' | 'staff' | 'phone'
export type MealSession = 'lunch' | 'dinner'

export interface ICheckIn extends mongoose.Document {
  elderlyId: mongoose.Types.ObjectId
  orderId?: mongoose.Types.ObjectId
  canteenId: mongoose.Types.ObjectId
  checkInTime: Date
  mealDate: Date
  mealSession: MealSession
  method: CheckInMethod
  operatorId?: mongoose.Types.ObjectId
  remark?: string
}

const checkInSchema = new mongoose.Schema<ICheckIn>(
  {
    elderlyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Elderly',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
      index: true,
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    mealDate: {
      type: Date,
      required: true,
      index: true,
    },
    mealSession: {
      type: String,
      enum: ['lunch', 'dinner'],
      required: true,
    },
    method: {
      type: String,
      enum: ['card', 'face', 'staff', 'phone'],
      required: true,
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    remark: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
)

checkInSchema.index({ elderlyId: 1, mealDate: 1, mealSession: 1 }, { unique: true })
checkInSchema.index({ canteenId: 1, mealDate: 1 })

export const CheckIn = mongoose.model<ICheckIn>('CheckIn', checkInSchema)
