USE online_exam_portal;

DROP TRIGGER IF EXISTS trg_increment_total_attempts;
DROP PROCEDURE IF EXISTS Add_Student;

DELIMITER $$

CREATE TRIGGER trg_increment_total_attempts
AFTER INSERT ON result
FOR EACH ROW
BEGIN
  UPDATE student
  SET total_attempts = total_attempts + 1
  WHERE student_id = NEW.student_id;
END$$

CREATE PROCEDURE Add_Student(
  IN p_email VARCHAR(120),
  IN p_password VARCHAR(255),
  IN p_first_name VARCHAR(60),
  IN p_last_name VARCHAR(60),
  IN p_enrollment_no VARCHAR(40)
)
BEGIN
  IF REGEXP_LIKE(p_email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid email format';
  END IF;

  INSERT INTO student (email, password, first_name, last_name, enrollment_no)
  VALUES (p_email, p_password, p_first_name, p_last_name, p_enrollment_no);
END$$

DELIMITER ;
