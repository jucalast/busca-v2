from pydantic import BaseModel
class Test(BaseModel):
    name: str
print(Test(name='val').model_dump())
