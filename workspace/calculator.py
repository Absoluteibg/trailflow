def calculator():
    print("Simple If-Else Calculator")
    
    try:
        num1 = float(input("Enter first number: "))
        operator = input("Enter operator (+, -, *, /): ")
        num2 = float(input("Enter second number: "))
    except ValueError:
        print("Invalid input! Please enter numbers.")
        return

    if operator == '+':
        result = num1 + num2
    elif operator == '-':
        result = num1 - num2
    elif operator == '*':
        result = num1 * num2
    elif operator == '/':
        if num2 == 0:
            print("Error: Cannot divide by zero.")
            return
        result = num1 / num2
    else:
        print("Invalid operator!")
        return

    print(f"Result: {num1} {operator} {num2} = {result}")

if __name__ == "__main__":
    calculator()
