import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function DateTimePicker({ value, onChange, placeholder = "Выбрать дату и время" }) {
  return (
    <div className="dtp-wrapper">
      <ReactDatePicker
        selected={value}
        onChange={onChange}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={5}
        dateFormat="d MMM, HH:mm"
        placeholderText={placeholder}
        minDate={new Date()}
        locale="ru"
        className="dtp-input"
        calendarClassName="dtp-calendar"
        popperClassName="dtp-popper"
        isClearable
        clearButtonClassName="dtp-clear"
        timeCaption="Время"
      />
    </div>
  );
}
